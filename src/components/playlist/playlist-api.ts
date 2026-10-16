"use client";

import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { AddPlanSuggestionInput, AddSongInput, CreatePlaylistInput, LearnSuggestionView, PatchPlaylistInput, PlaylistErrorBody, PlaylistView, ProfileRefreshResult, SongState, SoundsLikeSuggestions } from "@/lib/playlist-schema";

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

/** Save the busk form's act, artists and songs. `patch.revision` is the one last seen: a stale one comes back as code "stale". */
export const savePlaylist = (patch: Omit<PatchPlaylistInput, "songs"> & { songs?: Pick<AddSongInput, "title" | "artist" | "own" | "durationMs">[] }) => call("PATCH", "/api/playlist", patch);
/** Make a Repertoire from the songs of a busk ("Save these songs as your Repertoire"). */
export const createPlaylist = (seed: Omit<CreatePlaylistInput, "songs"> & { songs?: Pick<AddSongInput, "title" | "artist" | "own" | "durationMs">[] }) => call("POST", "/api/playlist", seed);

export type SuggestionResult = { ok: true; suggestion: LearnSuggestionView } | { ok: false; code: string; message: string };

/** "Add to Repertoire" on a plan's Songs to learn: a pending suggestion with no run. */
export async function addPlanSuggestion(input: AddPlanSuggestionInput): Promise<SuggestionResult> {
  try {
    const res = await fetch("/api/playlist/learn/suggestions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => null)) as ({ suggestion?: LearnSuggestionView } & Partial<PlaylistErrorBody>) | null;
    if (res.ok && data?.suggestion) return { ok: true, suggestion: data.suggestion };
    return { ok: false, code: data?.error?.code ?? "error", message: data?.error?.message ?? PLAYLIST_COPY.errors.unavailable };
  } catch {
    return { ok: false, code: "network", message: PLAYLIST_COPY.errors.network };
  }
}

export type ProfileRefreshOutcome = ({ ok: true } & ProfileRefreshResult) | { ok: false; code: string; message: string };

/** Loads the Spotify artist of the saved link and finds it in Qloo. Only when the link changed or Refresh was pressed. */
export async function refreshProfile(): Promise<ProfileRefreshOutcome> {
  try {
    const res = await fetch("/api/playlist/profile", { method: "POST", credentials: "same-origin" });
    const data = (await res.json().catch(() => null)) as (Partial<ProfileRefreshResult> & Partial<PlaylistErrorBody>) | null;
    if (res.ok && data?.playlist) return { ok: true, playlist: data.playlist, spotify: data.spotify ?? "ok", qloo: data.qloo ?? "skipped" };
    return { ok: false, code: data?.error?.code ?? "error", message: data?.error?.message ?? PLAYLIST_COPY.errors.unavailable };
  } catch {
    return { ok: false, code: "network", message: PLAYLIST_COPY.errors.network };
  }
}

/** Qloo's "artists you sound like" for the saved Spotify artist. Never throws: a failure reads as unavailable. */
export async function loadSoundsLike(signal?: AbortSignal): Promise<SoundsLikeSuggestions> {
  try {
    const res = await fetch("/api/playlist/sounds-like", { credentials: "same-origin", cache: "no-store", signal });
    const data = (await res.json().catch(() => null)) as SoundsLikeSuggestions | null;
    return res.ok && data ? data : { status: "unavailable", artists: [] };
  } catch {
    return { status: "unavailable", artists: [] };
  }
}
