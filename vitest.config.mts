import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${src}/` },
      // `server-only` throws outside React Server Components; tests run server code directly.
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["src/server/**/fixtures/**"],
      reporter: ["text-summary", "text", "html"],
      thresholds: {
        // The scoring engine is pure and must stay fully covered (architecture.md).
        "src/server/scoring/**": { 100: true },
      },
    },
  },
});
