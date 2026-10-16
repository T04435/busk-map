// QA unit checks (pure logic, no network). Run: pnpm exec vitest run --config qa/vitest.config.mts
// Standalone on purpose (same aliases and setup as vitest.config.mts), so QA never edits DEV's config.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${root("src")}/` },
      { find: /^server-only$/, replacement: root("tests/stubs/empty.ts") },
    ],
  },
  test: { root: root(""), environment: "node", include: ["qa/unit/**/*.test.ts"], setupFiles: [root("tests/setup.ts")] },
});
