import "server-only";

/**
 * STUB (U31 worktree only): the Spotify client agent owns this file and exports the real `spotifyLimitedUntil()`.
 * When Spotify has rate-limited the app, the time the limit lifts; otherwise null. The coordinator resolves this at merge.
 */
export async function spotifyLimitedUntil(): Promise<Date | null> {
  return null;
}
