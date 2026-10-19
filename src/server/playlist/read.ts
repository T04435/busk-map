import "server-only";
import type { PlaylistView } from "@/lib/playlist-schema";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { viewOf } from "./api";
import { playlistDurable, playlistStore } from "./store";
import { hashToken, tokenFromCookieHeader } from "./token";

/**
 * The Repertoire for a Cookie header, for server components (the busk form and /week pre-fill from it).
 * Never creates one, and never throws: no cookie, no durable store or a failed read all mean "no Repertoire",
 * so the page works exactly as it did before Repertoires.
 */
export async function playlistViewForCookie(cookieHeader: string | null): Promise<PlaylistView | null> {
  const token = tokenFromCookieHeader(cookieHeader);
  if (!token) return null;
  const store = playlistStore(testSwitches().offline);
  if (!playlistDurable(store)) return null;
  try {
    const playlist = await store.findByTokenHash(hashToken(token));
    return playlist ? await viewOf(store, playlist) : null;
  } catch (error) {
    log.warn("repertoire not read for a page", { store: store.kind, error: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}
