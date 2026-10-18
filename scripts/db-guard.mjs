/**
 * The main (production) database guard for every script that opens the database (migrate, smoke, seed, backfill, db:*).
 * On 16 Oct a `vercel env pull` left busk-map/.env.local pointing at the main branch; a script run with it would have written
 * to production. A script refuses the main endpoint unless it runs in the Vercel production build (VERCEL_ENV=production and
 * VERCEL=1). The error names the endpoint, never the URL.
 */
import { endpointOf, MAIN_ENDPOINT } from "./migrate-lib.mjs";

const URL_VARS = ["DATABASE_URL_UNPOOLED", "DATABASE_URL", "POSTGRES_URL", "POSTGRES_URL_NON_POOLING"];

/** { ok: true } or { ok: false, reason } for the database URLs in `env`. */
export function mainGuard(env) {
  const main = env.MIGRATE_MAIN_ENDPOINT || MAIN_ENDPOINT;
  const productionBuild = env.VERCEL_ENV === "production" && env.VERCEL === "1";
  for (const name of URL_VARS) {
    const endpoint = endpointOf(env[name]);
    if (endpoint === main && !productionBuild) {
      return {
        ok: false,
        reason: `${name} points at the main (production) database endpoint ${endpoint}. Scripts may only touch it inside the Vercel production build. Use .env.development.local (the dev branch), never .env.local.`,
      };
    }
  }
  return { ok: true };
}

/** Exits the process with a clear message when `mainGuard` refuses. `who` names the script. */
export function guardOrExit(who, env = process.env) {
  const verdict = mainGuard(env);
  if (!verdict.ok) {
    console.error(`${who}: refusing. ${verdict.reason}`);
    process.exit(1);
  }
}
