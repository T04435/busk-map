import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { TOOL_LABELS } from "@/server/agent/tools";

/**
 * The user-facing words of the Repertoire (docs/playlist-architecture.md §4): "Suggested set" and "Songs to learn" (the
 * plan's old "Setlist" and "Learn these"), and "Repertoire", never "Playlist". Code names (wire fields, tables, routes,
 * tool names) keep the old words; this reads the text a person can see: JSX text and string literals in components and
 * pages, and the agent's tool labels.
 */
const SRC = path.resolve(__dirname, "../../../src");
const FORBIDDEN = /\bsetlists?\b|learn these|\bplaylists?\b/i;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "ui" ? [] : files(full);
    return e.name.endsWith(".tsx") ? [full] : [];
  });
}

/** Text a reader can see: JSX text, and string literals that aren't a type, a key, an import, a URL path or an id. */
function visibleText(file: string, text = readFileSync(file, "utf8")): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const walk = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isLiteralTypeNode(n) || ts.isTypeNode(n) || ts.isElementAccessExpression(n)) return;
    if (ts.isJsxText(n)) out.push(n.text);
    else if (ts.isStringLiteralLike(n) && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) out.push(n.text);
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push(n.text);
    n.forEachChild(walk);
  };
  walk(source);
  return out.filter((t) => !t.startsWith("/") && !/^[\w-]+$/.test(t.trim()) && !t.includes("/api/") && !t.includes("localStorage"));
}

describe("user-facing words", () => {
  it("the scan sees visible text, and skips code names", () => {
    const sample = `import { x } from "@/lib/playlist";
      type T = Plan["setlist"];
      export const a = <h2 aria-label="Learn these">Setlist for {x}</h2>;
      const url = "/api/playlist"; const o = { setlist: 1 }; const t = \`Your playlist \${x}\`;`;
    expect(visibleText("sample.tsx", sample).filter((t) => FORBIDDEN.test(t)).sort()).toEqual(["Learn these", "Setlist for ", "Your playlist "]);
    expect(files(SRC).length).toBeGreaterThan(30);
  });

  it("no component or page shows Setlist, Learn these or Playlist", () => {
    const hits = files(SRC).flatMap((f) => visibleText(f).filter((t) => FORBIDDEN.test(t)).map((t) => `${path.relative(SRC, f)}: ${t.trim().slice(0, 80)}`));
    expect(hits).toEqual([]);
  });

  it("the Repertoire copy module says Repertoire, Suggested set and Songs to learn", () => {
    const all: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === "string") all.push(v);
      else if (typeof v === "function") {
        for (const args of [[3, 60], [3], ["x"], ["x", 3], [{ ok: true, mode: "agent", code: null, newCount: 2, skippedCount: 1 }]]) {
          try {
            const r = (v as (...a: unknown[]) => unknown)(...args);
            if (typeof r === "string") {
              all.push(r);
              break;
            }
          } catch {
            /* try the next argument shape */
          }
        }
      } else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(PLAYLIST_COPY);
    expect(all.length).toBeGreaterThan(80);
    expect(all.filter((t) => FORBIDDEN.test(t))).toEqual([]);
    expect(PLAYLIST_COPY).toMatchObject({
      name: "Repertoire",
      suggestedSet: "Suggested set",
      toLearn: "Songs you should learn",
      toLearnShort: "To learn",
      canSing: "Songs you can sing",
    });
    expect(PLAYLIST_COPY.suggestedSetFor("Bourke Street Mall")).toBe("Suggested set for Bourke Street Mall");
  });

  it("the agent's step labels use the same words, while the tool names keep the Design contract's", () => {
    expect(TOOL_LABELS.build_setlist).toBe("Suggested set for a pitch");
    expect(TOOL_LABELS.learn_these).toBe("Songs you should learn");
    expect(Object.values(TOOL_LABELS).filter((t) => FORBIDDEN.test(t))).toEqual([]);
    expect(Object.keys(TOOL_LABELS)).toEqual(expect.arrayContaining(["build_setlist", "learn_these"]));
  });
});
