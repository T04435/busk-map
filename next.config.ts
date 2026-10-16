import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const distDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR lets parallel builds (e2e .next-e2e, QA .next-qa) avoid overwriting a running server's .next.
  distDir,
  // Builds into another directory use tsconfig.dist.json, so Next adds that directory's types there, not to tsconfig.json.
  typescript: { tsconfigPath: distDir === ".next" ? "tsconfig.json" : "tsconfig.dist.json" },
  cacheComponents: true,
  // BotID is checked only on Vercel (VERCEL=1 during Vercel builds); see src/server/bot.ts.
  env: { NEXT_PUBLIC_BUSKMAP_BOTID: process.env.VERCEL ? "1" : "" },
  partialPrefetching: true,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// BotID: proxy rewrites for its challenge script (botid docs, "Configure redirects").
export default withBotId(nextConfig);
