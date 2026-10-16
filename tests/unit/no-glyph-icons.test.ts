import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Icons are SVG components, never text glyphs. Comments may keep arrows.
const GLYPHS = /[▸►▶→←↑↓⇒➜➔✓✔✗✕★]|››/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

describe("no glyph icons", () => {
  it("has no arrow, chevron, check or star glyph in any src tsx file", () => {
    const hits: string[] = [];
    for (const f of files(join(process.cwd(), "src"))) {
      stripComments(readFileSync(f, "utf8")).split("\n").forEach((line, i) => {
        if (GLYPHS.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
