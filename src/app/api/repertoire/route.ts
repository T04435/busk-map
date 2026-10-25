import { rejectBots } from "@/server/bot";
import { z } from "zod";
import { findArtists, findReleaseCounts, findTracks, getArtistCatalogue, MAX_RELEASE_IDS } from "@/server/adapters/repertoire";
import { getListeners, MAX_LISTENER_ARTISTS } from "@/server/adapters/songs";
import { MELBOURNE } from "@/server/cities";
import { testSwitches } from "@/server/env";
import { repertoireLimiter } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER } from "@/server/request";

const names = z
  .string()
  .trim()
  .min(1)
  .max(MAX_LISTENER_ARTISTS * 81)
  .transform((s) => s.split("|").map((n) => n.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(80)).min(1).max(MAX_LISTENER_ARTISTS));

/** The page may ask for a whole result list (10 ids); only the first MAX_RELEASE_IDS are looked up, the rest on a later call. */
const RELEASE_IDS_ASKED = 10;
const ids = z
  .string()
  .trim()
  .min(1)
  .max(RELEASE_IDS_ASKED * 41)
  .transform((s) => s.split("|").map((n) => n.trim()).filter(Boolean))
  .pipe(z.array(z.string().regex(/^[A-Za-z0-9-]{1,40}$/)).min(1).max(RELEASE_IDS_ASKED))
  .transform((list) => list.slice(0, MAX_RELEASE_IDS));

/** The act's "sounds like" artists for a song search: their versions come first (scoped queries are capped server-side). */
const actArtists = z
  .string()
  .trim()
  .max(10 * 81)
  .transform((s) => s.split("|").map((n) => n.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(80)).max(10));

const querySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tracks"), q: z.string().trim().min(2).max(100), artists: actArtists.optional() }),
  z.object({ type: z.literal("artists"), q: z.string().trim().min(2).max(100) }),
  z.object({ type: z.literal("artist"), link: z.string().trim().min(10).max(300) }),
  z.object({ type: z.literal("listeners"), names }),
  z.object({ type: z.literal("releases"), ids }),
]);

const json = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, { ...init, headers: { "Cache-Control": "no-store", ...init.headers } });

/**
 * GET /api/repertoire?type=tracks&q=…[&artists=A|B]  searches songs for the picker (cover, album, duration);
 *                                         tracks by the act's artists come first (plus a scoped query for each of the first three).
 * GET /api/repertoire?type=artists&q=…    searches artists (photo; releases null, so the first answer is fast).
 * GET /api/repertoire?type=releases&ids=A|B  release counts per Spotify artist id, loaded after the artist results.
 * GET /api/repertoire?type=artist&link=…  loads a performer's own catalogue.
 * GET /api/repertoire?type=listeners&names=A|B  Last.fm listener counts, loaded after the artist results.
 * Spotify app credentials only; no user login. BotID and a per-IP rate limit guard every call.
 */
export async function GET(request: Request) {
  const blocked = await rejectBots("/api/repertoire");
  if (blocked) return blocked;
  // Offline test mode spends nothing, so it is not rate limited.
  const limit = testSwitches().offline ? { ok: true, retryAfterS: 0 } : repertoireLimiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return json(
      { error: { code: "rate_limited", message: "Too many searches in a short time. Wait a moment and try again." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } },
    );
  }
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return json({ error: { code: "invalid_request", message: "Invalid search." } }, { status: 400 });
  }
  const context = adapterContextFor(request.headers.get(FAULTS_HEADER));
  const market = MELBOURNE.countryCode;
  const query = parsed.data;
  switch (query.type) {
    case "tracks": {
      const result = await findTracks(query.q, market, context, query.artists ?? []);
      return json({ mode: result.mode, reason: result.reason ?? null, tracks: result.data });
    }
    case "artist": {
      const result = await getArtistCatalogue(query.link, market, context);
      return json({ mode: result.mode, reason: result.reason ?? null, tracks: result.data });
    }
    case "artists": {
      const result = await findArtists(query.q, market, context);
      return json({ mode: result.mode, reason: result.reason ?? null, artists: result.data });
    }
    case "releases": {
      const result = await findReleaseCounts(query.ids, market, context);
      return json({ mode: result.mode, reason: result.reason ?? null, releases: result.data });
    }
    case "listeners": {
      const result = await getListeners(query.names, context);
      return json({ mode: result.mode, reason: result.reason ?? null, listeners: result.data });
    }
  }
}
