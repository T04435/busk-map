/**
 * Routes protected by Vercel BotID. The browser attaches BotID's headers to
 * these requests (src/instrumentation-client.ts) and each route handler checks
 * them (src/server/bot.ts). Keep both in step: an unlisted route fails the check.
 */
export const BOTID_PROTECTED_ROUTES = [
  { path: "/api/plan", method: "POST" },
  { path: "/api/plans", method: "POST" },
  { path: "/api/compare", method: "POST" },
  { path: "/api/week", method: "POST" },
  // The week's calendar export: a read of stored plans, still challenged (it is linked from the page only).
  { path: "/api/week/ics", method: "GET" },
  { path: "/api/repertoire", method: "GET" },
  // City search for the busk form (Open-Meteo geocoding, cached).
  { path: "/api/cities", method: "GET" },
  // Genre search in the research ask (Qloo /v2/tags, cached).
  { path: "/api/genres", method: "GET" },
  // The Repertoire's writes (docs/playlist-architecture.md §1.1). Reads are cheap and aren't challenged.
  { path: "/api/playlist", method: "POST" },
  { path: "/api/playlist", method: "PATCH" },
  { path: "/api/playlist", method: "DELETE" },
  { path: "/api/playlist/songs", method: "POST" },
  { path: "/api/playlist/songs/*", method: "PATCH" },
  { path: "/api/playlist/songs/*", method: "DELETE" },
  { path: "/api/playlist/learn/suggestions", method: "POST" },
  // A learn run spends model money, so BotID matters most here (docs §1.1). The status changes are writes.
  { path: "/api/playlist/learn", method: "POST" },
  // Repertoire research: a learn run with a Spotify link (one summary model call).
  { path: "/api/playlist/research", method: "POST" },
  // The answer to a research run that waits for input: the same run carries on (Qloo calls and the summary model call).
  { path: "/api/playlist/research/*/input", method: "POST" },
  { path: "/api/playlist/learn/suggestions/*", method: "PATCH" },
  // Refresh the Repertoire profile (Spotify/Last.fm reads): a write, guarded server-side (T01).
  { path: "/api/playlist/profile", method: "POST" },
] as const;
