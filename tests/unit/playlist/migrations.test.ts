import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** The same split scripts/migrate.mjs makes (that script runs on import, so it is copied here). */
const statements = (sql: string) =>
  sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";").map((s) => s.trim()).filter(Boolean);

const read = (file: string) => readFileSync(path.join(process.cwd(), "migrations", file), "utf8");

describe("migrations 004 and 005", () => {
  it("are idempotent: every statement is IF NOT EXISTS", () => {
    for (const file of ["004_playlists.sql", "005_learn_runs.sql"]) {
      for (const statement of statements(read(file))) expect(statement, `${file}: ${statement.slice(0, 50)}`).toMatch(/IF NOT EXISTS/);
    }
  });

  it("playlist_songs: one row per song key in a Repertoire, and the limits as checks", () => {
    const sql = read("004_playlists.sql");
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS playlist_songs_key ON playlist_songs \(playlist_id, song_key\)/);
    expect(sql).toMatch(/token_hash TEXT NOT NULL UNIQUE CHECK \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
    expect(sql).toMatch(/state IN \('can_sing', 'learned'\)/);
  });

  it("learn_suggestions: a song is suggested to a Repertoire once, whatever its status (never re-suggest, D9)", () => {
    const sql = read("005_learn_runs.sql");
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS learn_suggestions_key ON learn_suggestions \(playlist_id, song_key\)/);
    // The index covers every status: it is not partial.
    expect(sql).not.toMatch(/learn_suggestions_key[^;]*WHERE/);
  });

  it("learn_runs: one running run per Repertoire (partial unique index)", () => {
    expect(read("005_learn_runs.sql")).toMatch(/learn_runs_one_running ON learn_runs \(playlist_id\) WHERE status = 'running'/);
  });
});
