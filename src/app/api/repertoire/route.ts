import { z } from "zod";
import { findTracks, getArtistCatalogue } from "@/server/adapters/repertoire";
import { CITIES } from "@/server/cities";
import { adapterContextFor, FAULTS_HEADER } from "@/server/request";

const querySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tracks"), q: z.string().trim().min(2).max(100) }),
  z.object({ type: z.literal("artist"), link: z.string().trim().min(10).max(300) }),
]);

/**
 * GET /api/repertoire?type=tracks&q=… searches songs for the picker.
 * GET /api/repertoire?type=artist&link=… loads a performer's own catalogue.
 * Spotify app credentials only; no user login.
 */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_request", message: "Invalid search." } }, { status: 400 });
  }
  const context = adapterContextFor(request.headers.get(FAULTS_HEADER));
  const market = CITIES.melbourne.countryCode;
  const result =
    parsed.data.type === "tracks"
      ? await findTracks(parsed.data.q, market, context)
      : await getArtistCatalogue(parsed.data.link, market, context);
  return Response.json(
    { mode: result.mode, reason: result.reason ?? null, tracks: result.data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
