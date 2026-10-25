import { z } from "zod";
import { rejectBots } from "@/server/bot";
import { testSwitches } from "@/server/env";
import { searchGenres } from "@/server/playlist/own-artist";
import { genreSearchLimiter } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER } from "@/server/request";

const querySchema = z.object({ q: z.string().trim().min(2).max(40) });

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { "Cache-Control": "no-store", ...init.headers } });

/**
 * GET /api/genres?q=regg  Qloo genre tags whose name matches, for the research ask's genre search (/v2/tags, cached for days).
 * Answer: { mode: "live" | "fallback", genres: { id, name }[] }: music genres only, never a place or a people, best match first.
 * BotID and a per-IP rate limit guard it, like the other search routes.
 */
export async function GET(request: Request) {
  const blocked = await rejectBots("/api/genres");
  if (blocked) return blocked;
  const limit = testSwitches().offline ? { ok: true, retryAfterS: 0 } : genreSearchLimiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return json({ error: { code: "rate_limited", message: "Too many searches in a short time. Wait a moment and try again." } }, { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } });
  }
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return json({ error: { code: "invalid_request", message: "Type at least 2 letters of the genre." } }, { status: 400 });
  const genres = await searchGenres(parsed.data.q, adapterContextFor(request.headers.get(FAULTS_HEADER)));
  return genres === "unavailable" ? json({ mode: "fallback", genres: [] }) : json({ mode: "live", genres });
}
