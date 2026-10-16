/**
 * Migration runner with schema_migrations tracking. Pure of process state: the
 * SQL client, the directory and the logger are passed in, so tests use a fake.
 * Never logs the connection string.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Statements in a migration file, comments removed. */
export function statements(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const checksum = (content) => createHash("sha256").update(content).digest("hex");

/**
 * Where may we run? Returns { action: "run" | "skip" | "refuse", reason }.
 * - production runs ONLY inside the Vercel production build (VERCEL_ENV=production and VERCEL=1);
 * - production without VERCEL=1 is refused (a manual run must never reach prod);
 * - `--if-production` (the vercel-build hook) skips everywhere else, exit 0;
 * - anything else (local, dev branch) runs.
 */
export function gate(env, flags = []) {
  const production = env.VERCEL_ENV === "production";
  if (production) {
    if (env.VERCEL === "1") return { action: "run", reason: "Vercel production build" };
    return { action: "refuse", reason: "VERCEL_ENV=production without VERCEL=1: production migrations run only inside the Vercel production build." };
  }
  if (flags.includes("--if-production")) {
    return { action: "skip", reason: `not a production build (VERCEL_ENV=${env.VERCEL_ENV || "unset"}), skipping migrations` };
  }
  return { action: "run", reason: "non-production run" };
}

/**
 * Apply the files in `dir` that schema_migrations has not recorded, in name order.
 * `sql` has query(text, params) and transaction((txn) => [txn.query(...), ...]).
 * Throws on any error (checksum mismatch, SQL failure); earlier files stay applied.
 */
export async function runMigrations({ sql, dir, log = console.log }) {
  await sql.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename TEXT PRIMARY KEY,
       checksum TEXT NOT NULL,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const rows = await sql.query("SELECT filename, checksum FROM schema_migrations");
  const recorded = new Map(rows.map((r) => [r.filename, r.checksum]));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  // Immutability first, so a tampered file fails before anything new is applied.
  const contents = new Map();
  for (const file of files) {
    const content = readFileSync(path.join(dir, file), "utf8");
    contents.set(file, content);
    if (recorded.has(file) && recorded.get(file) !== checksum(content)) {
      throw new Error(`Migration ${file} changed after it was applied (checksum mismatch). Applied migrations are immutable; add a new file instead.`);
    }
  }

  const applied = [];
  const skipped = [];
  for (const file of files) {
    if (recorded.has(file)) {
      log(`skipped ${file} (already applied)`);
      skipped.push(file);
      continue;
    }
    const content = contents.get(file);
    const list = statements(content);
    try {
      await sql.transaction((txn) => [
        ...list.map((s) => txn.query(s)),
        txn.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [file, checksum(content)]),
      ]);
    } catch (error) {
      throw new Error(`Migration ${file} failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`);
    }
    log(`applied ${file} (${list.length} statements)`);
    applied.push(file);
  }
  return { applied, skipped };
}
