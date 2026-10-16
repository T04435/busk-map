"use client";

import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { AddSongInput, PlaylistErrorBody, PlaylistView, SongState } from "@/lib/playlist-schema";

/** Client for /api/playlist/*. Errors come back as plain, friendly words; nothing here throws. */
export type PlaylistResult = { ok: true; playlist: PlaylistView | null } | { ok: false; code: string; message: string };

async function call(method: string, path: string, body?: unknown): Promise<PlaylistResult> {
  try {
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as ({ playlist?: PlaylistView | null } & Partial<PlaylistErrorBody>) | null;
    if (res.ok) return { ok: true, playlist: data?.playlist ?? null };
    return { ok: false, code: data?.error?.code ?? "error", message: data?.error?.message ?? PLAYLIST_COPY.errors.unavailable };
  } catch {
    return { ok: false, code: "network", message: PLAYLIST_COPY.errors.network };
  }
}

export const loadPlaylist = () => call("GET", "/api/playlist");
export const addSong = (song: Pick<AddSongInput, "title" | "artist"> & Partial<AddSongInput>) => call("POST", "/api/playlist/songs", song);
export const moveSong = (id: string, state: SongState) => call("PATCH", `/api/playlist/songs/${encodeURIComponent(id)}`, { state });
export const removeSong = (id: string) => call("DELETE", `/api/playlist/songs/${encodeURIComponent(id)}`);
export const forgetPlaylist = () => call("DELETE", "/api/playlist");
