import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { COOKIE_MAX_AGE_S } from "./config";

/**
 * The anonymous device cookie (docs/playlist-architecture.md §1.1). The value is a random 128-bit token;
 * the database keeps only its sha256. The token never appears in a URL, a plan request or a short link.
 */
export const PLAYLIST_COOKIE = "buskmap_playlist";

const TOKEN = /^[A-Za-z0-9_-]{22}$/;

/** 16 random bytes as base64url: 22 characters. */
export function newToken(): string {
  return randomBytes(16).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The token in a Cookie header, or null when absent or malformed. */
export function tokenFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== PLAYLIST_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    return TOKEN.test(value) ? value : null;
  }
  return null;
}

/** Set-Cookie value: HttpOnly, SameSite=Lax, 400 days, Secure in production (not on the offline test server, which runs on http). */
export function setCookieHeader(token: string, secure: boolean): string {
  return `${PLAYLIST_COOKIE}=${token}; Max-Age=${COOKIE_MAX_AGE_S}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function clearCookieHeader(secure: boolean): string {
  return `${PLAYLIST_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
