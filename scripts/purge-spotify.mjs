#!/usr/bin/env node
/**
 * pnpm purge:spotify: deletes or nulls the Spotify data stored in Postgres (images, metadata, profile snapshots, research and
 * run steps, cached runs, Spotify pacer rows). Keeps the Spotify IDs and our own data. Idempotent.
 * Refuses before 10 Nov 2026 (UTC) unless --force. Uses the main-database guard (db-guard.mjs) before connecting.
 *   node --env-file=.env.development.local scripts/purge-spotify.mjs [--force]
 */
import { neon } from "@neondatabase/serverless";
import { guardOrExit } from "./db-guard.mjs";
import { purgeGate, runPurge } from "./purge-spotify-lib.mjs";

const verdict = purgeGate(new Date(), process.argv.slice(2));
if (verdict.action === "refuse") {
  console.error(`purge-spotify: refusing. ${verdict.reason}`);
  process.exit(1);
}
guardOrExit("purge-spotify");
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("purge-spotify: DATABASE_URL is not set.");
  process.exit(1);
}
console.log(`purge-spotify: ${verdict.reason}`);
const total = await runPurge(neon(url), (line) => console.log(line));
console.log(`purge-spotify: done, ${total} rows changed.`);
