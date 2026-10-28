import "server-only";
import { z } from "zod";

/**
 * Validated, server-only environment.
 *
 * - Every third-party key is optional: a missing key turns the matching
 *   provider off, and the adapter falls back (see architecture.md).
 * - "SET_ME" (the Vercel placeholder) and blank values count as missing.
 * - Never log values from here. Use `providerStatus()` for diagnostics: it
 *   only reports booleans.
 */

const PLACEHOLDERS = new Set(["", "SET_ME"]);

/** A secret that may be absent. Blank or "SET_ME" becomes `undefined`. */
const optionalSecret = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed && !PLACEHOLDERS.has(trimmed.toUpperCase()) ? trimmed : undefined;
  });

const flag = z
  .string()
  .optional()
  .transform((value) => value === "1" || value?.toLowerCase() === "true");

export const envSchema = z.object({
  QLOO_API_KEY: optionalSecret,
  QLOO_API_BASE_URL: z.url().default("https://hackathon.api.qloo.com"),
  /**
   * Optional: a drop-in proxy for Qloo's API (NotOnQ, e.g. https://notonq.vercel.app/q/app/busk-map). When set, live Qloo calls
   * go to it first and straight to QLOO_API_BASE_URL when it fails (adapters/qloo/client.ts). Unset or blank: Qloo direct only.
   */
  QLOO_PROXY_BASE_URL: z.preprocess((value) => {
    const trimmed = typeof value === "string" ? value.trim() : undefined;
    return trimmed && !PLACEHOLDERS.has(trimmed.toUpperCase()) ? trimmed.replace(/\/+$/, "") : undefined;
  }, z.url().optional()),
  /**
   * Serve Qloo from the local mock (src/server/qloo-mock) even when a key is
   * set. The mock is also used whenever QLOO_API_KEY is missing.
   */
  QLOO_MOCK: flag,
  /** Expose the mock over HTTP at /api/_mock/qloo (always on outside production). */
  QLOO_MOCK_ROUTE: flag,
  /** Postgres (e.g. Neon) for the plain-AI baseline comparison stats. Optional: without it, comparisons aren't recorded. */
  DATABASE_URL: optionalSecret,
  TICKETMASTER_API_KEY: optionalSecret,
  LASTFM_API_KEY: optionalSecret,
  SPOTIFY_CLIENT_ID: optionalSecret,
  SPOTIFY_CLIENT_SECRET: optionalSecret,
  /** Local development uses the project's OIDC token or an explicit key. */
  AI_GATEWAY_API_KEY: optionalSecret,
  VERCEL_OIDC_TOKEN: optionalSecret,
  /** Set to "1" by the Vercel runtime, where the gateway authenticates via OIDC. */
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  /**
   * Test-only switches. Ignored when VERCEL_ENV is "production".
   * - BUSKMAP_ALLOW_FAULTS lets a request simulate provider outages (e2e).
   * - BUSKMAP_OFFLINE serves every provider from synthetic fixtures and swaps
   *   the gateway model for a deterministic mock (e2e, CI).
   * - BUSKMAP_OFFLINE_DB (with BUSKMAP_OFFLINE) keeps the mocks but uses DATABASE_URL for the Repertoire and learn stores,
   *   and applies the learn run limits, so the Postgres SQL can be smoke-tested without any model or Qloo cost. Point it at
   *   a Neon dev branch only (pnpm smoke:db does).
   */
  BUSKMAP_ALLOW_FAULTS: flag,
  BUSKMAP_OFFLINE: flag,
  BUSKMAP_OFFLINE_DB: flag,
  /** A fixed ISO instant for the server clock (e2e). Honoured only with BUSKMAP_ALLOW_FAULTS; see server/clock.ts. */
  BUSKMAP_FAKE_NOW: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export type ProviderName = "qloo" | "ticketmaster" | "lastfm" | "spotify" | "aiGateway";

export type ProviderStatus = Record<ProviderName, boolean>;

/** Parse an env-like record. Pure, so tests can call it with any input. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Report which variables are malformed, never their values.
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid environment variables: ${names.join(", ")}`);
  }
  return result.data;
}

export function providerStatusOf(env: Env): ProviderStatus {
  return {
    qloo: Boolean(env.QLOO_API_KEY),
    ticketmaster: Boolean(env.TICKETMASTER_API_KEY),
    lastfm: Boolean(env.LASTFM_API_KEY),
    spotify: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET),
    aiGateway: Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || env.VERCEL === "1"),
  };
}

/** Test switches are never honoured in production. */
export function testSwitchesOf(env: Env) {
  const allowed = env.VERCEL_ENV !== "production";
  return {
    allowFaults: allowed && env.BUSKMAP_ALLOW_FAULTS,
    offline: allowed && env.BUSKMAP_OFFLINE,
    /** Offline mocks with the real database and the real learn run limits (a smoke test). Needs offline. */
    offlineDb: allowed && env.BUSKMAP_OFFLINE && env.BUSKMAP_OFFLINE_DB,
  };
}

/**
 * The database for the Repertoire and learn stores: DATABASE_URL, except in offline test mode, which keeps everything in
 * memory unless BUSKMAP_OFFLINE_DB is also set.
 */
export function storeDatabaseUrlOf(env: Env, offline: boolean): string | undefined {
  const { offlineDb } = testSwitchesOf(env);
  return offline && !offlineDb ? undefined : env.DATABASE_URL;
}

export type QlooBackend = "live" | "mock";

/** Live Qloo needs a key and no mock switch; everything else uses the local mock. */
export function qlooBackendOf(env: Env, offline: boolean): QlooBackend {
  return !offline && env.QLOO_API_KEY && !env.QLOO_MOCK ? "live" : "mock";
}

/** The HTTP mock route is for development: off in production unless explicitly enabled. */
export function qlooMockRouteEnabledOf(env: Env): boolean {
  return env.VERCEL_ENV !== "production" || env.QLOO_MOCK_ROUTE;
}

let cached: Env | undefined;

/** The process environment, parsed once. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Which providers have credentials. Booleans only: safe to log or render. */
export function providerStatus(): ProviderStatus {
  return providerStatusOf(env());
}

export function qlooBackend(offline: boolean): QlooBackend {
  return qlooBackendOf(env(), offline);
}

export function testSwitches() {
  return testSwitchesOf(env());
}

export function storeDatabaseUrl(offline: boolean): string | undefined {
  return storeDatabaseUrlOf(env(), offline);
}
