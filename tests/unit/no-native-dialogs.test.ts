import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The user's rule: every dialog is a shadcn component (AlertDialog, Dialog, Sheet), never the browser's alert/confirm/prompt.
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(tsx?|mjs)$/.test(name) ? [full] : [];
  });

describe("no native browser dialogs", () => {
  it("src never calls alert(), confirm() or prompt()", () => {
    const hits = files(path.join(process.cwd(), "src")).flatMap((file) =>
      readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
        .split("\n")
        .flatMap((line, i) => (/(^|[^\w.])(window\.)?(alert|confirm|prompt)\(/.test(line) ? [`${path.relative(process.cwd(), file)}:${i + 1}`] : [])),
    );
    expect(hits).toEqual([]);
  });
});
