/**
 * Short plan ids for share links (/p/<id>): 9 base-62 characters, about 53
 * bits. Random from crypto.getRandomValues with rejection sampling, so every
 * character is equally likely (no modulo bias). Collisions are retried by the
 * store (server/plans/store.ts).
 */
export const PLAN_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const PLAN_ID_LENGTH = 9;
const PLAN_ID_PATTERN = /^[0-9A-Za-z]{9}$/;
/** 62 × 4 = 248: bytes from 248 to 255 are dropped, so byte % 62 is uniform. */
const LIMIT = 256 - (256 % PLAN_ID_ALPHABET.length);

type Fill = (bytes: Uint8Array) => Uint8Array;
const cryptoFill: Fill = (bytes) => crypto.getRandomValues(bytes);

export function newPlanId(fill: Fill = cryptoFill): string {
  let id = "";
  while (id.length < PLAN_ID_LENGTH) {
    const bytes = fill(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte >= LIMIT) continue;
      id += PLAN_ID_ALPHABET[byte % PLAN_ID_ALPHABET.length];
      if (id.length === PLAN_ID_LENGTH) break;
    }
  }
  return id;
}

export function isPlanId(value: unknown): value is string {
  return typeof value === "string" && PLAN_ID_PATTERN.test(value);
}

/** The share path for a plan id. */
export const planPath = (id: string) => `/p/${id}`;

/** Sent with POST /api/plan by /p/<id>: the plan the finished run is kept on. */
export const PLAN_ID_HEADER = "x-buskmap-plan";
/** Sent with POST /api/plan for `?fresh=1` (developer path; refused in production builds). */
export const FRESH_HEADER = "x-buskmap-fresh";
