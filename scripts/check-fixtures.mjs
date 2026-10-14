#!/usr/bin/env node
// Fixture provenance check (architecture.md, quality gates).
//
// 1. Every file under a `fixtures/` directory must carry the SYNTHETIC FIXTURE
//    marker, so real provider responses (above all Qloo's) never land in git.
// 2. Any other tracked source file that looks like a Qloo response (an
//    `entity_id` next to a UUID) fails the check.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MARKER = "SYNTHETIC FIXTURE";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => /\.(ts|tsx|js|mjs|json)$/.test(file))
  .filter((file) => file !== "scripts/check-fixtures.mjs" && file !== "pnpm-lock.yaml");

const problems = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // deleted in the working tree
  }
  const isFixture = /(^|\/)fixtures\//.test(file);
  if (isFixture && !text.includes(MARKER)) {
    problems.push(`${file}: fixture without the "${MARKER}" marker`);
  }
  if (!isFixture && /entity_id/.test(text) && UUID.test(text)) {
    problems.push(`${file}: looks like a Qloo response (entity_id with a UUID)`);
  }
}

if (problems.length > 0) {
  console.error(`Fixture provenance check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Fixture provenance check passed (${files.length} files).`);
