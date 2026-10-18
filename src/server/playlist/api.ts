import "server-only";
import type { PlaylistErrorBody, PlaylistView } from "@/lib/playlist-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { rejectBots } from "@/server/bot";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { playlistCreateGate } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { playlistDurable, playlistStore, toPlaylistView, type PlaylistRecord, type PlaylistStore } from "./store";
import { clearCookieHeader, hashToken, newToken, setCookieHeader, tokenFromCookieHeader } from "./token";

/** Shared by the /api/playlist/* handlers: identity from the cookie, the guards, and the response shapes. */

const secureCookie = () => process.env.NODE_ENV === "production" && !testSwitches().offline;

export function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}, cookies: string[] = []): Response {
  const headers = new Headers({ "Cache-Control": "no-store", ...init.headers });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return Response.json(body, { status: init.status, headers });
}

export function errorResponse(status: number, code: string, message: string, headers?: Record<string, string>, cookies: string[] = []): Response {
  const body: PlaylistErrorBody = { error: { code, message } };
  return json(body, { status, headers }, cookies);
}

/**
 * Mutating routes: a browser sends `Origin`; it must name this host (SameSite=Lax already blocks cross-site POSTs).
 * A request with no Origin (curl, tests, server-side) can't be a cross-site browser form, so it passes.
 */
export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** The guards every mutating route runs first: the Origin check, then BotID. Null means carry on. */
export async function guardMutation(request: Request, route: string): Promise<Response | null> {
  if (!originAllowed(request)) return errorResponse(403, "bad_origin", "This request came from another site.");
  return rejectBots(route);
}

export type Session = {
  store: PlaylistStore;
  /** The token in the cookie, if it is well-formed. */
  token: string | null;
  playlist: PlaylistRecord | null;
};

/** Reads the cookie and finds the Repertoire. A response means it can't be served (no durable store). */
export async function readSession(request: Request): Promise<Session | Response> {
  const store = playlistStore(testSwitches().offline);
  if (!playlistDurable(store)) return errorResponse(503, "unavailable", PLAYLIST_COPY.errors.unavailable);
  const token = tokenFromCookieHeader(request.headers.get("cookie"));
  try {
    const playlist = token ? await store.findByTokenHash(hashToken(token)) : null;
    return { store, token, playlist };
  } catch (error) {
    log.warn("repertoire not read", { store: store.kind, error: error instanceof Error ? error.message : "unknown" });
    return errorResponse(503, "unavailable", PLAYLIST_COPY.errors.unavailable);
  }
}

export const isResponse = (v: unknown): v is Response => v instanceof Response;

/**
 * The session's Repertoire, created on the first save behind the creation limit (10 an hour per IP).
 * `newCookie` is set when a token was just issued.
 */
export async function ensurePlaylist(
  request: Request,
  session: Session,
): Promise<{ playlist: PlaylistRecord; cookies: string[] } | Response> {
  if (session.playlist && session.token) return { playlist: session.playlist, cookies: [setCookieHeader(session.token, secureCookie())] };
  const gate = playlistCreateGate({ offline: testSwitches().offline, ip: clientIp(request.headers) });
  if (!gate.ok) return errorResponse(429, "limit", PLAYLIST_COPY.errors.tooMany, { "Retry-After": String(gate.retryAfterS) });
  const token = newToken();
  try {
    const playlist = await session.store.create(hashToken(token));
    return { playlist, cookies: [setCookieHeader(token, secureCookie())] };
  } catch (error) {
    log.warn("repertoire not created", { store: session.store.kind, error: error instanceof Error ? error.message : "unknown" });
    return errorResponse(503, "unavailable", PLAYLIST_COPY.errors.unavailable);
  }
}

export async function viewOf(store: PlaylistStore, playlist: PlaylistRecord): Promise<PlaylistView> {
  // Re-read the record so the revision the client gets is the one after the write.
  const [fresh, songs] = await Promise.all([store.get(playlist.id), store.songs(playlist.id)]);
  return toPlaylistView(fresh ?? playlist, songs);
}

export const clearCookie = () => clearCookieHeader(secureCookie());

/** The session's existing Repertoire (never creates one): a 404 `no_playlist` when the cookie has none. */
export async function ensureExisting(request: Request): Promise<(Session & { playlist: PlaylistRecord; cookies: string[] }) | Response> {
  const session = await readSession(request);
  if (isResponse(session)) return session;
  if (!session.playlist || !session.token) return errorResponse(404, "no_playlist", PLAYLIST_COPY.errors.notFound);
  return { ...session, playlist: session.playlist, cookies: [setCookieHeader(session.token, secureCookie())] };
}
