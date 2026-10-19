import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checksum,
  endpointOf,
  gate,
  MAIN_ENDPOINT,
  runMigrations,
  statements,
} from "../../scripts/migrate-lib.mjs";

type Txn = {
  query: (
    text: string,
    params?: unknown[],
  ) => { text: string; params?: unknown[] };
};

/** A fake Neon client: records schema_migrations rows and the statements run. */
function fakeClient(
  opts: { recorded?: Record<string, string>; failOn?: string } = {},
) {
  const table = new Map(Object.entries(opts.recorded ?? {}));
  const ran: string[] = [];
  const sql = {
    async query(text: string) {
      if (text.startsWith("SELECT filename"))
        return [...table].map(([filename, checksum]) => ({
          filename,
          checksum,
        }));
      return [];
    },
    async transaction(
      build: (txn: Txn) => { text: string; params?: unknown[] }[],
    ) {
      const queries = build({ query: (text, params) => ({ text, params }) });
      const staged: string[] = [];
      let row: [string, string] | undefined;
      for (const q of queries) {
        if (opts.failOn && q.text.includes(opts.failOn))
          throw new Error("boom");
        if (q.text.startsWith("INSERT INTO schema_migrations"))
          row = q.params as [string, string];
        else staged.push(q.text);
      }
      // Commit only when every statement passed (rollback otherwise).
      ran.push(...staged);
      if (row) table.set(row[0], row[1]);
    },
  };
  return { sql, table, ran };
}

function dirWith(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "migrations-"));
  for (const [name, content] of Object.entries(files))
    writeFileSync(path.join(dir, name), content);
  return dir;
}

describe("runMigrations", () => {
  it("applies unrecorded files in name order and records them", async () => {
    const dir = dirWith({
      "002_b.sql": "CREATE TABLE b (x int);",
      "001_a.sql": "-- c\nCREATE TABLE a (x int);\nCREATE INDEX i ON a (x);",
    });
    const { sql, table, ran } = fakeClient();
    const logs: string[] = [];
    const result = await runMigrations({
      sql,
      dir,
      log: (m: string) => logs.push(m),
    });
    expect(result.applied).toEqual(["001_a.sql", "002_b.sql"]);
    expect(ran).toEqual([
      "CREATE TABLE a (x int)",
      "CREATE INDEX i ON a (x)",
      "CREATE TABLE b (x int)",
    ]);
    expect([...table.keys()]).toEqual(["001_a.sql", "002_b.sql"]);
    expect(logs).toEqual([
      "applied 001_a.sql (2 statements)",
      "applied 002_b.sql (1 statements)",
    ]);
  });

  it("skips recorded files and applies only the pending ones", async () => {
    const a = "CREATE TABLE a (x int);";
    const dir = dirWith({
      "001_a.sql": a,
      "002_b.sql": "CREATE TABLE b (x int);",
    });
    const { sql, ran } = fakeClient({ recorded: { "001_a.sql": checksum(a) } });
    const logs: string[] = [];
    const result = await runMigrations({
      sql,
      dir,
      log: (m: string) => logs.push(m),
    });
    expect(result).toEqual({ applied: ["002_b.sql"], skipped: ["001_a.sql"] });
    expect(ran).toEqual(["CREATE TABLE b (x int)"]);
    expect(logs[0]).toBe("skipped 001_a.sql (already applied)");
  });

  it("a second run skips everything", async () => {
    const dir = dirWith({ "001_a.sql": "CREATE TABLE a (x int);" });
    const { sql } = fakeClient();
    await runMigrations({ sql, dir, log: () => {} });
    const second = await runMigrations({ sql, dir, log: () => {} });
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["001_a.sql"]);
  });

  it("fails on a changed checksum, naming the file, before applying anything new", async () => {
    const dir = dirWith({
      "001_a.sql": "CREATE TABLE a (y int);",
      "002_b.sql": "CREATE TABLE b (x int);",
    });
    const { sql, ran } = fakeClient({
      recorded: { "001_a.sql": checksum("CREATE TABLE a (x int);") },
    });
    await expect(runMigrations({ sql, dir, log: () => {} })).rejects.toThrow(
      /001_a\.sql[\s\S]*immutable[\s\S]*add a new file/,
    );
    expect(ran).toEqual([]);
  });

  it("stops at the first failing file: later files are not run and the failing one is not recorded", async () => {
    const dir = dirWith({
      "001_a.sql": "CREATE TABLE a (x int);",
      "002_b.sql": "BAD STATEMENT;",
      "003_c.sql": "CREATE TABLE c (x int);",
    });
    const { sql, table, ran } = fakeClient({ failOn: "BAD" });
    await expect(runMigrations({ sql, dir, log: () => {} })).rejects.toThrow(
      /002_b\.sql failed and was rolled back: boom/,
    );
    expect([...table.keys()]).toEqual(["001_a.sql"]);
    expect(ran).toEqual(["CREATE TABLE a (x int)"]);
  });

  it("never logs the connection URL", async () => {
    const dir = dirWith({ "001_a.sql": "CREATE TABLE a (x int);" });
    const { sql } = fakeClient();
    const logs: string[] = [];
    await runMigrations({ sql, dir, log: (m: string) => logs.push(m) });
    expect(logs.join("\n")).not.toMatch(/postgres|neon\.tech|@/);
  });
});

describe("statements", () => {
  it("drops comment lines and splits on semicolons", () => {
    expect(statements("-- x\nA;\n-- y\nB;\n")).toEqual(["A", "B"]);
  });
});

describe("gate", () => {
  it("runs in the Vercel production build", () => {
    expect(
      gate({ VERCEL_ENV: "production", VERCEL: "1" }, ["--if-production"])
        .action,
    ).toBe("run");
  });
  it("skips preview and development builds with --if-production", () => {
    expect(
      gate({ VERCEL_ENV: "preview", VERCEL: "1" }, ["--if-production"]).action,
    ).toBe("skip"); // no database URL
    expect(
      gate({ VERCEL_ENV: "development", VERCEL: "1" }, ["--if-production"])
        .action,
    ).toBe("skip");
    expect(gate({}, ["--if-production"]).action).toBe("skip");
  });
  it("refuses production without VERCEL=1", () => {
    expect(gate({ VERCEL_ENV: "production" }, []).action).toBe("refuse");
    expect(gate({ VERCEL_ENV: "production" }, ["--if-production"]).action).toBe(
      "refuse",
    );
  });
  it("runs locally without the flag (pnpm db:migrate:dev)", () => {
    expect(gate({}, []).action).toBe("run");
    expect(gate({ VERCEL_ENV: "preview" }, []).action).toBe("run");
  });
});

describe("preview builds migrate only on a Neon preview branch", () => {
  const url = (host: string) =>
    `postgresql://user:secret@${host}/neondb?sslmode=require`;
  it("runs on a preview branch endpoint", () => {
    const decision = gate(
      {
        VERCEL_ENV: "preview",
        VERCEL: "1",
        DATABASE_URL_UNPOOLED: url(
          "ep-shiny-preview-a1b2c3d4.ap-southeast-2.aws.neon.tech",
        ),
      },
      ["--if-production"],
    );
    expect(decision.action).toBe("run");
    expect(decision.reason).not.toContain("secret");
  });
  it("skips when the preview points at main, pooled or not", () => {
    expect(
      gate(
        {
          VERCEL_ENV: "preview",
          VERCEL: "1",
          DATABASE_URL_UNPOOLED: url(
            `${MAIN_ENDPOINT}.ap-southeast-2.aws.neon.tech`,
          ),
        },
        ["--if-production"],
      ).action,
    ).toBe("skip");
    expect(
      gate(
        {
          VERCEL_ENV: "preview",
          VERCEL: "1",
          DATABASE_URL_UNPOOLED: url(
            `${MAIN_ENDPOINT}-pooler.ap-southeast-2.aws.neon.tech`,
          ),
        },
        ["--if-production"],
      ).action,
    ).toBe("skip");
  });
  it("skips when the endpoint can't be read, and outside the Vercel build", () => {
    expect(
      gate(
        {
          VERCEL_ENV: "preview",
          VERCEL: "1",
          DATABASE_URL_UNPOOLED: "not a url",
        },
        ["--if-production"],
      ).action,
    ).toBe("skip");
    expect(
      gate(
        {
          VERCEL_ENV: "preview",
          DATABASE_URL_UNPOOLED: url("ep-shiny-preview-a1b2c3d4.aws.neon.tech"),
        },
        ["--if-production"],
      ).action,
    ).toBe("skip");
  });
  it("reads endpoint ids without the pooler suffix", () => {
    expect(
      endpointOf(
        url("ep-long-fog-a7x2ifwi-pooler.ap-southeast-2.aws.neon.tech"),
      ),
    ).toBe("ep-long-fog-a7x2ifwi");
    expect(endpointOf(undefined)).toBeNull();
  });
});
