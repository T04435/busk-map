import { z } from "zod";
import { isCityId } from "@/lib/fans-map";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { testSwitches } from "@/server/env";
import { fansMapFor, FansMapQlooDown } from "@/server/research/fans-map";
import { errorResponse, isResponse, json, readSession } from "@/server/playlist/api";
import { RESEARCH_SIGNAL_SOUND_ALIKES } from "@/server/playlist/config";
import { repertoireLimiter } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER } from "@/server/request";

const query = z.object({ city: z.string().max(40) });

/**
 * GET /api/playlist/research/fans-map?city=<id>: "Where your fans are" for another city (the map's city switch). One Qloo
 * urn:heatmap call per city, answered from the Qloo client's cache when warm; it never starts a research run and saves nothing
 * (the snapshot keeps the map the run made). Answers the same shape as the research step's output (FansMapOutput).
 * 400 bad_city, 404 no_playlist, 409 no_research (the act has no Qloo entity yet), 429, 502 qloo_unavailable, 503.
 */
export async function GET(request: Request) {
  const parsed = query.safeParse({ city: new URL(request.url).searchParams.get("city") ?? "" });
  if (!parsed.success || !isCityId(parsed.data.city)) return errorResponse(400, "bad_city", "That city isn't supported yet.");
  const session = await readSession(request);
  if (isResponse(session)) return session;
  const playlist = session.playlist;
  if (!playlist) return errorResponse(404, "no_playlist", PLAYLIST_COPY.errors.notFound);
  const qloo = playlist.research?.steps.qloo?.output;
  const ownId = qloo?.matched ? qloo.qlooId : playlist.qlooArtistId;
  if (!ownId) return errorResponse(409, "no_research", PLAYLIST_COPY.research.errors.noResearch);
  const limit = testSwitches().offline ? { ok: true, retryAfterS: 0 } : repertoireLimiter.check(clientIp(request.headers));
  if (!limit.ok) return errorResponse(429, "rate_limited", PLAYLIST_COPY.errors.rateLimited, { "Retry-After": String(limit.retryAfterS) });
  const alikes = playlist.soundsLike.filter((a) => a.qlooId).slice(0, RESEARCH_SIGNAL_SOUND_ALIKES) as { qlooId: string; name: string }[];
  try {
    const out = await fansMapFor({
      cityId: parsed.data.city,
      own: { id: ownId, name: qloo?.name ?? playlist.actName ?? "you" },
      alikes,
      adapters: adapterContextFor(request.headers.get(FAULTS_HEADER)),
    });
    return json(out);
  } catch (error) {
    if (error instanceof FansMapQlooDown) return errorResponse(502, "qloo_unavailable", "Qloo didn't answer. Try again in a moment.");
    throw error;
  }
}
