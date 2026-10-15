#!/usr/bin/env node
/**
 * Apply migrations/*.sql (idempotent) over Neon's DIRECT connection,
 * DATABASE_URL_UNPOOLED. Run against the dev branch only:
 *
 *   pnpm db:migrate:dev   (reads .env.development.local, which points at the Neon dev branch)
 *
 * Never prints the connection string. Refuses to run with VERCEL_ENV=production.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

if (process.env.VERCEL_ENV === "production") {
  console.error("Refusing to migrate with VERCEL_ENV=production. Production migrations are a separate, reviewed step.");
  process.exit(1);
}
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED is not set (expected in .env.development.local).");
  process.exit(1);
}

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

const sql = neon(url);
const dir = path.join(process.cwd(), "migrations");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const list = statements(readFileSync(path.join(dir, file), "utf8"));
  for (const statement of list) await sql.query(statement);
  console.log(`Applied ${file} (${list.length} statements)`);
}
const [{ count }] = await sql.query("SELECT count(*)::int AS count FROM baseline_comparisons");
const [{ stored }] = await sql.query("SELECT count(*)::int AS stored FROM plan_store");
const [{ plans }] = await sql.query("SELECT count(*)::int AS plans FROM plans");
console.log(`baseline_comparisons rows: ${count}; plan_store rows: ${stored}; plans rows: ${plans}`);
