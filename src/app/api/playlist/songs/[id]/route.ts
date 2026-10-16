import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { songStateSchema } from "@/lib/playlist-schema";
import { ensureExisting, errorResponse, guardMutation, isResponse, json, viewOf } from "@/server/playlist/api";
import { toSongView } from "@/server/playlist/store";

/**
 * PATCH  /api/playlist/songs/<id>  { state: "can_sing" | "learned" }: move a song between the two lists.
 * DELETE /api/playlist/songs/<id>  remove a song.
 * The id belongs to the Repertoire in the cookie: another device's song id is simply not found.
 */
export async function PATCH(request: Request, { params }: RouteContext<"/api/playlist/songs/[id]">) {
  const blocked = await guardMutation(request, "/api/playlist/songs/*");
  if (blocked) return blocked;
  const parsed = songStateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "invalid_request", PLAYLIST_COPY.errors.invalid);
  const existing = await ensureExisting(request);
  if (isResponse(existing)) return existing;
  const song = await existing.store.setSongState(existing.playlist.id, (await params).id, parsed.data.state);
  if (!song) return errorResponse(404, "song_not_found", PLAYLIST_COPY.errors.notFound, undefined, existing.cookies);
  return json({ song: toSongView(song), playlist: await viewOf(existing.store, existing.playlist) }, {}, existing.cookies);
}

export async function DELETE(request: Request, { params }: RouteContext<"/api/playlist/songs/[id]">) {
  const blocked = await guardMutation(request, "/api/playlist/songs/*");
  if (blocked) return blocked;
  const existing = await ensureExisting(request);
  if (isResponse(existing)) return existing;
  const removed = await existing.store.removeSong(existing.playlist.id, (await params).id);
  if (!removed) return errorResponse(404, "song_not_found", PLAYLIST_COPY.errors.notFound, undefined, existing.cookies);
  return json({ playlist: await viewOf(existing.store, existing.playlist) }, {}, existing.cookies);
}
