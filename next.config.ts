import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  /* config options here */
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
