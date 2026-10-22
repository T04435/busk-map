import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VersionBadge } from "@/components/honeycomb/version-badge";
import { envTag, versionLabel, versionText, type AppVersion } from "@/lib/version";

const base: AppVersion = {
  version: "1.1.0",
  sha: "b7595e4aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  shortSha: "b7595e4",
  env: "production",
  branch: "main",
  dirty: false,
  builtAt: "2026-10-23T00:00:00.000Z",
  releaseUrl: "https://github.com/o/r/releases/tag/v1.1.0",
  commitUrl: "https://github.com/o/r/commit/b7595e4",
};

describe("version text", () => {
  it("formats production as the tag and hash only", () => {
    expect(versionLabel(base)).toBe("v1.1.0 @ b7595e4");
    expect(versionText(base)).toBe("v1.1.0 @ b7595e4");
  });

  it("adds the env and branch on preview", () => {
    const v = { ...base, env: "preview" as const, shortSha: "3f1addd", branch: "feat/sing" };
    expect(versionText(v)).toBe("v1.1.0 @ 3f1addd (preview, feat/sing)");
  });

  it("adds local, and dirty only with uncommitted changes", () => {
    const clean = { ...base, env: "local" as const, shortSha: "3f1addd" };
    expect(versionText(clean)).toBe("v1.1.0 @ 3f1addd (local)");
    expect(versionText({ ...clean, dirty: true })).toBe("v1.1.0 @ 3f1addd (local, dirty)");
  });

  it("maps Vercel's development env to local", () => {
    expect(envTag({ ...base, env: "development" })).toBe("local");
    expect(envTag({ ...base, env: "production" })).toBe("production");
    expect(envTag({ ...base, env: "preview" })).toBe("preview");
  });
});

describe("VersionBadge", () => {
  const html = (env: AppVersion["env"]) => renderToStaticMarkup(createElement(VersionBadge, { version: { ...base, env, branch: "feat/sing", dirty: true } }));
  const text = (out: string) => out.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  it("is the primary Badge on every env: one colour, mono, no marker, no brand or tint", () => {
    for (const env of ["production", "preview", "local", "development"] as const) {
      const out = html(env);
      expect(out).toContain('data-variant="default"');
      expect(out).toContain("bg-primary");
      expect(out).toContain("font-mono");
      expect(out).not.toContain("size-2");
      expect(out).not.toContain("--tone");
      expect(out).not.toContain("--brand");
    }
  });

  it("reads tag @ hash on production, with links to the release and the commit", () => {
    const out = html("production");
    expect(text(out)).toBe("v1.1.0 @ b7595e4");
    expect(out).toContain('href="https://github.com/o/r/releases/tag/v1.1.0"');
    expect(out).toContain('href="https://github.com/o/r/commit/b7595e4"');
  });

  it("adds the env and branch on preview, and local with dirty", () => {
    expect(text(html("preview"))).toBe("v1.1.0 @ b7595e4 · preview · feat/sing");
    expect(text(html("local"))).toBe("v1.1.0 @ b7595e4 · local · dirty");
  });
});
