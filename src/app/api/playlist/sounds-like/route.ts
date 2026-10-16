import { adapterContextFor, FAULTS_HEADER } from "@/server/request";
import { json, readSession, isResponse } from "@/server/playlist/api";
import { soundsLikeFor } from "@/server/playlist/own-artist";

/**
 * GET /api/playlist/sounds-like: suggestions for "Artists you sound like", from the performer's own Qloo artist
 * (insights, `filter.type=urn:entity:artist`, signalled with that entity). Reads the saved `qlooArtistId`; it never looks
 * the artist up again. Status: ok | no_artist (no Spotify link) | not_loaded (profile not fetched yet) |
 * unknown_artist (Qloo doesn't know it) | unavailable (Qloo didn't answer) | no_playlist.
 * Nothing is saved: the client adds the ones the performer picks to its own list.
 */
export async function GET(request: Request) {
  const session = await readSession(request);
  if (isResponse(session)) return session;
  if (!session.playlist) return json({ status: "no_playlist", artists: [] });
  return json(await soundsLikeFor(session.playlist, adapterContextFor(request.headers.get(FAULTS_HEADER))));
}
