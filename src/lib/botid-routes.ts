/**
 * Routes protected by Vercel BotID. The browser attaches BotID's headers to
 * these requests (src/instrumentation-client.ts) and each route handler checks
 * them (src/server/bot.ts). Keep both in step: an unlisted route fails the check.
 */
export const BOTID_PROTECTED_ROUTES = [
  { path: "/api/plan", method: "POST" },
  { path: "/api/compare", method: "POST" },
  { path: "/api/week", method: "POST" },
  { path: "/api/repertoire", method: "GET" },
] as const;
