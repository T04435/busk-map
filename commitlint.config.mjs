/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  // Rule starts at the Conventional Commits adoption commit; older history stays as it is.
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "chore", "refactor", "perf", "test", "build", "ci", "style", "revert"],
    ],
    // Our subjects are lowercase-ish but may carry proper nouns (Qloo, Spotify, Last.fm).
    "subject-case": [0],
    "subject-full-stop": [2, "never", "."],
    "subject-empty": [2, "never"],
    // Header: allow the long descriptive subjects we write, but keep it bounded.
    "header-max-length": [2, "always", 120],
    // Normal bodies are long prose; footers carry Co-Authored-By.
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
    // Usual scopes are a hint only (level 0 = never an error).
    "scope-enum": [
      0,
      "always",
      ["repertoire", "plan", "hive", "brand", "landing", "qloo", "spotify", "lastfm", "research", "api", "e2e", "repo", "release", "deps", "av"],
    ],
  },
};
