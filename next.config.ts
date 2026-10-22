import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";
import { execSync } from "node:child_process";
import pkg from "./package.json" with { type: "json" };

// The running version (docs: learnings/2026-10-23-app-version-in-footer.md): baked in at build time, read only by src/lib/version.ts.
const git = (cmd: string) => {
  try {
    return execSync(cmd).toString().trim();
  } catch {
    return "";
  }
};
const sha = process.env.VERCEL_GIT_COMMIT_SHA || git("git rev-parse HEAD");
const dirty = !process.env.VERCEL && git("git status --porcelain") !== "";

const distDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR lets parallel builds (e2e .next-e2e, QA .next-qa) avoid overwriting a running server's .next.
  distDir,
  // Builds into another directory use tsconfig.dist.json, so Next adds that directory's types there, not to tsconfig.json.
  typescript: { tsconfigPath: distDir === ".next" ? "tsconfig.json" : "tsconfig.dist.json" },
  cacheComponents: true,
  // BotID is checked only on Vercel (VERCEL=1 during Vercel builds); see src/server/bot.ts.
  env: {
    NEXT_PUBLIC_BUSKMAP_BOTID: process.env.VERCEL ? "1" : "",
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_SHA: sha,
    NEXT_PUBLIC_APP_ENV: process.env.VERCEL_ENV || "local",
    NEXT_PUBLIC_APP_BRANCH: process.env.VERCEL_GIT_COMMIT_REF || git("git rev-parse --abbrev-ref HEAD"),
    NEXT_PUBLIC_APP_DIRTY: dirty ? "1" : "",
    NEXT_PUBLIC_APP_BUILT_AT: new Date().toISOString(),
    NEXT_PUBLIC_APP_REPO: "https://github.com/T04435/busk-map",
  },
  partialPrefetching: true,
  // Vercel restores .next/cache between deployments. A stale Turbopack cache served an old globals.css (the create-next-app one:
  // no Honeycomb tokens, fonts or --taste-*) on a preview, so the build cache is off; builds recompile from the source every time.
  experimental: { turbopackFileSystemCacheForBuild: false },

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
