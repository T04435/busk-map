import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { createPlaylistSchema, patchPlaylistSchema } from "@/lib/playlist-schema";
import { clearCookie, ensurePlaylist, errorResponse, guardMutation, isResponse, json, readSession, viewOf } from "@/server/playlist/api";

/**
 * The device Repertoire (docs/playlist-architecture.md §3.6). The id never leaves the server; the cookie
 * `buskmap_playlist` (httpOnly) is the only handle.
 *
 * GET     my Repertoire, or { playlist: null }. Never creates one.
 * POST    create it (idempotent: an existing one is returned as it is). Sets the cookie. 10 new an hour per IP.
 *         An optional body seeds a new one: { actName, soundsLike, spotifyArtistId, songs } ("Save these songs as your Repertoire").
 * PATCH   act name, sounds like, usual pitches, and the whole set of songs you can sing. Needs the `revision`
 *         last seen: 409 when stale.
 * DELETE  forget: deletes the Repertoire and clears the cookie.
 */
export async function GET(request: Request) {
  const session = await readSession(request);
  if (isResponse(session)) return session;
  if (!session.playlist) return json({ playlist: null });
  return json({ playlist: await viewOf(session.store, session.playlist) });
}

export async function POST(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist");
  if (blocked) return blocked;
  // No body (or an empty one) makes an empty Repertoire, as before; a body that is there must be valid.
  const text = await request.text().catch(() => "");
  const seedBody = text.trim() ? createPlaylistSchema.safeParse(safeJson(text)) : null;
  if (seedBody && !seedBody.success) return errorResponse(400, "invalid_request", PLAYLIST_COPY.errors.invalid);
  const session = await readSession(request);
  if (isResponse(session)) return session;
  const created = !session.playlist;
  const made = await ensurePlaylist(request, session);
  if (isResponse(made)) return made;
  const seed = seedBody?.data;
  if (created && seed && (seed.actName !== undefined || seed.soundsLike || seed.spotifyArtistId !== undefined || seed.spotifyProfile !== undefined || seed.qlooArtistId !== undefined || seed.songs?.length)) {
    await session.store.update(made.playlist.id, { revision: made.playlist.revision, actName: seed.actName, soundsLike: seed.soundsLike, spotifyArtistId: seed.spotifyArtistId, spotifyProfile: seed.spotifyProfile, qlooArtistId: seed.qlooArtistId, songs: seed.songs });
  }
  return json({ playlist: await viewOf(session.store, made.playlist) }, { status: created ? 201 : 200 }, made.cookies);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function PATCH(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist");
  if (blocked) return blocked;
  const parsed = patchPlaylistSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "invalid_request", PLAYLIST_COPY.errors.invalid);
  const session = await readSession(request);
  if (isResponse(session)) return session;
  if (!session.playlist) return errorResponse(404, "no_playlist", PLAYLIST_COPY.errors.notFound);
  const result = await session.store.update(session.playlist.id, parsed.data);
  if (!result.ok) {
    return result.reason === "stale"
      ? errorResponse(409, "stale", PLAYLIST_COPY.errors.stale)
      : errorResponse(404, "no_playlist", PLAYLIST_COPY.errors.notFound);
  }
  return json({ playlist: await viewOf(session.store, result.playlist) });
}

export async function DELETE(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist");
  if (blocked) return blocked;
  const session = await readSession(request);
  if (isResponse(session)) return session;
  if (session.playlist) await session.store.forget(session.playlist.id);
  return json({ playlist: null }, {}, [clearCookie()]);
}
