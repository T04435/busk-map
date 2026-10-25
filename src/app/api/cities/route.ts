import { z } from "zod";
import { findCities } from "@/server/adapters/geocode";
import { rejectBots } from "@/server/bot";
import { testSwitches } from "@/server/env";
import { citySearchLimiter } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER } from "@/server/request";

const querySchema = z.object({ q: z.string().trim().min(2).max(80) });

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { "Cache-Control": "no-store", ...init.headers } });

/**
 * GET /api/cities?q=tok  cities whose name matches, for the busk form's city picker (Open-Meteo geocoding, cached a week).
 * Answer: { mode, reason, cities: CityOption[] } (lib/city.ts), populated places only, best match first.
 * BotID and a per-IP rate limit guard it, like the other search routes.
 */
export async function GET(request: Request) {
  const blocked = await rejectBots("/api/cities");
  if (blocked) return blocked;
  const limit = testSwitches().offline ? { ok: true, retryAfterS: 0 } : citySearchLimiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return json({ error: { code: "rate_limited", message: "Too many searches in a short time. Wait a moment and try again." } }, { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } });
  }
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return json({ error: { code: "invalid_request", message: "Type at least 2 letters of the city." } }, { status: 400 });
  const result = await findCities(parsed.data.q, adapterContextFor(request.headers.get(FAULTS_HEADER)));
  return json({ mode: result.mode, reason: result.reason ?? null, cities: result.data });
}
