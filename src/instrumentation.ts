/**
 * Warm the example plans when a self-hosted server starts (`next start`), so
 * the first judge never waits on cold data sources. On Vercel the landing
 * page does the same through POST /api/warm.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL) return;
  const port = process.env.PORT ?? "3000";
  setTimeout(() => {
    void fetch(`http://127.0.0.1:${port}/api/warm`, { method: "POST" }).catch(() => {});
  }, 1500);
}
