import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The user's rule (18 Oct 2026): one Song component, one Artist component, one profile, and one component for each extra
 * ("13 and 14 versions of the same component is SLOP"). A song renders only through honeycomb/song-row, an artist only through
 * honeycomb/artist-chip, the act through honeycomb/artist-profile. This blocks new song or artist markup outside them; the e2e
 * twin (tests/e2e/one-song-one-artist.spec.ts) checks the rendered pages.
 *
 * A line that has to name a song or an artist in plain text (an aria-label, a sentence of prose) says why with
 * `// unify-ok: <reason>` on that line or the line above.
 */
const ROOT = path.join(process.cwd(), "src");
/** The components themselves, the shadcn primitives, and BRAND's specimen pages that show them. */
const OWNERS = ["components/honeycomb/", "components/ui/", "components/brand/", "app/design/", "app/brand/"].map((d) => path.join(ROOT, d));

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : name.endsWith(".tsx") ? [full] : [];
  });

const scanned = files(ROOT).filter((f) => !OWNERS.some((o) => f.startsWith(o)));

/** The old song/artist components, deleted by the unify round: nothing may bring them back. */
const GONE = ["LearnSongCard", "PickedSongs", "ProfileHeader", "RepertoireProfile", "PercentCell", "WithCells"];

const RULES: { name: string; re: RegExp }[] = [
  // A song title or its artist printed as a JSX child from a song-ish variable: `{song.title}`, `{s.artist}` (props like
  // title={s.title} are fine; `{item.title}` on a copy list is not a song).
  { name: "song title/artist as JSX text (use SongRow)", re: /(?<![=\w])\{\s*(?:(?:song|track|pick|suggestion|learn|played|setlist)\w*|s|t|r|row|x|entry)\??\.(title|artist)\s*\}/i },
  // An artist's name printed as a JSX child from an artist-ish variable.
  { name: "artist name as JSX text (use ArtistChip)", re: /(?<![=\w])\{\s*(artist|a|sim|similar|fan|picked|suggested|related|act)\w*\??\.name\s*\}/i },
  // A plain-text artist list: artists.map(...).join(", ") (use ArtistChipList inline).
  { name: "plain-text artist list (use ArtistChipList)", re: /artists?\w*\??\.(map\([^)]*=>\s*\w+\??\.name\)\??\.)?join\(/i },
];

function hits(file: string): string[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const rel = path.relative(process.cwd(), file);
  const out: string[] = [];
  lines.forEach((raw, i) => {
    const ok = /unify-ok:/.test(raw) || /unify-ok:/.test(lines[i - 1] ?? "");
    const line = raw.replace(/\/\/.*$/, "");
    if (ok) return;
    for (const g of GONE) if (new RegExp(`\\b${g}\\b`).test(line)) out.push(`${rel}:${i + 1} uses ${g}, which was replaced by the unified components`);
    for (const r of RULES) if (r.re.test(line)) out.push(`${rel}:${i + 1} ${r.name}`);
  });
  return out;
}

describe("one Song, one Artist (unify rule)", () => {
  it("no song or artist markup outside SongRow, ArtistChip and ArtistProfile", () => {
    expect(scanned.flatMap(hits)).toEqual([]);
  });

  it("the old components are deleted", () => {
    const left = ["components/playlist/learn-song-card.tsx", "components/playlist/profile-header.tsx", "components/honeycomb/with-cells.tsx", "components/honeycomb/repertoire/repertoire-profile.tsx"].filter((f) => {
      try {
        return statSync(path.join(ROOT, f)).isFile();
      } catch {
        return false;
      }
    });
    expect(left).toEqual([]);
  });

  it("each unified component marks its root for the e2e check", () => {
    for (const [file, slot] of [
      ["song-row.tsx", "song-row"],
      ["artist-chip.tsx", "artist-chip"],
      ["artist-profile.tsx", "artist-profile"],
    ]) {
      expect(readFileSync(path.join(ROOT, "components/honeycomb", file), "utf8")).toContain(`data-slot="${slot}"`);
    }
  });
});
