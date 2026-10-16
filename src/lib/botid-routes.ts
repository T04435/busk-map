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
  { path: "/api/repertoire", method: "GET" },
  // The Repertoire's writes (docs/playlist-architecture.md §1.1). Reads are cheap and aren't challenged.
  { path: "/api/playlist", method: "POST" },
  { path: "/api/playlist", method: "PATCH" },
  { path: "/api/playlist", method: "DELETE" },
  { path: "/api/playlist/songs", method: "POST" },
  { path: "/api/playlist/songs/*", method: "PATCH" },
  { path: "/api/playlist/songs/*", method: "DELETE" },
  { path: "/api/playlist/learn/suggestions", method: "POST" },
] as const;
