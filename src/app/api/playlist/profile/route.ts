import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { ProfileRefreshResult } from "@/lib/playlist-schema";
import { testSwitches } from "@/server/env";
import { repertoireLimiter } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER } from "@/server/request";
import { errorResponse, guardMutation, isResponse, json, readSession, viewOf } from "@/server/playlist/api";
import { refreshOwnArtist } from "@/server/playlist/own-artist";

/**
 * POST /api/playlist/profile: (re)load the Spotify artist of the Repertoire's saved link and find the same artist in Qloo.
 * The client calls it only when the link changes or the performer presses Refresh, never on page load. It saves
 * `spotifyProfile` (name, photos, genres) and `qlooArtistId` (null when Qloo doesn't know the artist, so it isn't
 * retried until the next refresh). When Spotify doesn't answer, the saved snapshot stays. No body.
 */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist/profile");
  if (blocked) return blocked;
  const session = await readSession(request);
  if (isResponse(session)) return session;
  const playlist = session.playlist;
  if (!playlist) return errorResponse(404, "no_playlist", PLAYLIST_COPY.errors.notFound);
  const limit = testSwitches().offline ? { ok: true, retryAfterS: 0 } : repertoireLimiter.check(clientIp(request.headers));
  if (!limit.ok) return errorResponse(429, "rate_limited", PLAYLIST_COPY.errors.rateLimited, { "Retry-After": String(limit.retryAfterS) });

  if (!playlist.spotifyArtistId) {
    const cleared = await session.store.update(playlist.id, { revision: playlist.revision, spotifyProfile: null, qlooArtistId: null });
    const view = await viewOf(session.store, cleared.ok ? cleared.playlist : playlist);
    return json({ playlist: view, spotify: "no_link", qloo: "skipped" } satisfies ProfileRefreshResult);
  }

  const refreshed = await refreshOwnArtist(playlist.spotifyArtistId, adapterContextFor(request.headers.get(FAULTS_HEADER)));
  if (!refreshed.profile) {
    // Spotify didn't answer: keep what is saved. A link Spotify doesn't know is reported as such.
    return json({ playlist: await viewOf(session.store, playlist), spotify: refreshed.spotify, qloo: "skipped" } satisfies ProfileRefreshResult);
  }
  const saved = await session.store.update(playlist.id, { revision: playlist.revision, spotifyProfile: refreshed.profile, qlooArtistId: refreshed.qlooArtistId });
  if (!saved.ok) return saved.reason === "stale" ? errorResponse(409, "stale", PLAYLIST_COPY.errors.stale) : errorResponse(404, "no_playlist", PLAYLIST_COPY.errors.notFound);
  return json({ playlist: await viewOf(session.store, saved.playlist), spotify: "ok", qloo: refreshed.qloo } satisfies ProfileRefreshResult);
}
