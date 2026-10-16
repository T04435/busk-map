#!/usr/bin/env node
/**
 * Apply migrations/*.sql over Neon's DIRECT connection (DATABASE_URL_UNPOOLED),
 * recording each in schema_migrations; only unrecorded files run.
 *
 *   pnpm db:migrate:dev          local, reads .env.development.local (the Neon dev branch)
 *   --if-production              the `vercel-build` hook: runs in the Vercel production build, and in a Vercel
 *                                preview build only when its database is a Neon preview branch (not main);
 *                                skips (exit 0) everywhere else
 *
 * Production runs ONLY with VERCEL_ENV=production and VERCEL=1 (the Vercel build env);
 * a manual run with VERCEL_ENV=production alone is refused. Any error exits non-zero,
 * which fails the build. Never prints the connection string.
 * `--dir <path>` points at another migrations directory (tests, verification).
 */
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { gate, runMigrations } from "./migrate-lib.mjs";

const args = process.argv.slice(2);
const decision = gate(process.env, args);
if (decision.action === "skip") {
  console.log(`migrate: ${decision.reason}`);
  process.exit(0);
}
if (decision.action === "refuse") {
  console.error(`migrate: refusing. ${decision.reason}`);
  process.exit(1);
}
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("migrate: DATABASE_URL_UNPOOLED is not set.");
  process.exit(1);
}
const dirFlag = args.indexOf("--dir");
const dir = dirFlag >= 0 ? path.resolve(args[dirFlag + 1]) : path.join(process.cwd(), "migrations");

console.log(`migrate: ${decision.reason}`);
try {
  const { applied, skipped } = await runMigrations({ sql: neon(url), dir });
  console.log(`migrate: done, ${applied.length} applied, ${skipped.length} skipped`);
} catch (error) {
  console.error(`migrate: FAILED. ${error instanceof Error ? error.message.split(url).join("[url]") : "unknown error"}`);
  process.exit(1);
}
