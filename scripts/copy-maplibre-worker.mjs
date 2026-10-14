#!/usr/bin/env node
// MapLibre GL v6 loads its web worker from a URL next to its own module, which
// a bundler rewrites. Copy the self-contained worker into public/ (versioned,
// git-ignored) so the map can point setWorkerUrl at a stable path.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const target = join("public", "vendor", `maplibre-gl-worker-${version}.mjs`);
mkdirSync(dirname(target), { recursive: true });
copyFileSync(join(dirname(pkgPath), "dist", "maplibre-gl-worker.mjs"), target);
console.log(`Copied MapLibre worker to ${target}`);
