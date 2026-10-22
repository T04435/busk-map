// Fails if the git tag is not "v" + package.json's version. Tag = the first argument, else GITHUB_REF_NAME (tag pushes in CI),
// else the tag at HEAD (local pre-push). With no tag at all there is nothing to check.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const fromGit = () => {
  try {
    return execSync("git tag --points-at HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().split("\n").filter((t) => /^v\d/.test(t));
  } catch {
    return [];
  }
};
const tags = process.argv[2] ? [process.argv[2]] : process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME ? [process.env.GITHUB_REF_NAME] : fromGit();

if (tags.length === 0) {
  console.log("check-version-tag: no version tag to check.");
  process.exit(0);
}
const expected = `v${pkg.version}`;
const bad = tags.filter((t) => t !== expected);
if (bad.length > 0) {
  console.error(`check-version-tag: tag ${bad.join(", ")} does not match package.json version (expected ${expected}).`);
  process.exit(1);
}
console.log(`check-version-tag: ${tags.join(", ")} matches package.json.`);
