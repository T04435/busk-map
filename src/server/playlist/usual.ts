import "server-only";
import type { Plan, PlanRequest } from "@/lib/plan-schema";
import { songsMatchRepertoire } from "@/lib/repertoire-prefill";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { playlistDurable, playlistStore } from "./store";
import { hashToken, tokenFromCookieHeader } from "./token";

/**
 * Usual pitches (docs/playlist-architecture.md D4): when a busk planned with the Repertoire finishes, its top pitch is
 * recorded, and the usual pitches become the pitches of the last few such busks (config.ts:USUAL_PITCHES_FROM_LAST_PLANS).
 *
 * "Planned with the Repertoire" means the request's songs are exactly the cookie's Repertoire (the plan request carries
 * no Repertoire id, §3.2). A busk with edited songs, an example, or a device with no Repertoire records nothing.
 * Recording never throws and never changes the Repertoire's revision.
 */
export async function recordBuskForRepertoire(
  cookieHeader: string | null,
  request: Pick<PlanRequest, "performer">,
  plan: Pick<Plan, "pitches">,
  planKey: string,
  { example = false, now = Date.now() }: { example?: boolean; now?: number } = {},
): Promise<boolean> {
  const top = plan.pitches[0];
  const token = tokenFromCookieHeader(cookieHeader);
  if (example || !top || !token) return false;
  const store = playlistStore(testSwitches().offline);
  if (!playlistDurable(store)) return false;
  try {
    const playlist = await store.findByTokenHash(hashToken(token));
    if (!playlist) return false;
    const songs = await store.songs(playlist.id);
    if (!songsMatchRepertoire(request.performer.songs, { songs })) return false;
    await store.recordBusk(playlist.id, { key: planKey, at: now, name: top.name, lat: top.lat, lon: top.lon });
    return true;
  } catch (error) {
    log.warn("usual pitch not recorded", { store: store.kind, error: error instanceof Error ? error.message : "unknown" });
    return false;
  }
}
