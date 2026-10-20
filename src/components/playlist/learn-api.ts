"use client";

import { learnStreamEventSchema, type LearnListView, type LearnStreamEvent, type PatchSuggestionInput } from "@/lib/learn-schema";
import { ndjsonLines } from "@/lib/learn-live";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { LearnSuggestionView, PlaylistErrorBody, PlaylistSongView } from "@/lib/playlist-schema";

/** Client for the learn routes (docs/playlist-architecture.md §7). Nothing here throws: errors come back as plain words. */
export type Refusal = { ok: false; status: number; code: string; message: string; extra: Record<string, unknown> };

const network: Refusal = { ok: false, status: 0, code: "network", message: PLAYLIST_COPY.errors.network, extra: {} };

async function refusalOf(res: Response): Promise<Refusal> {
  const data = (await res.json().catch(() => null)) as ({ error?: { code?: string; message?: string } & Record<string, unknown> } & Partial<PlaylistErrorBody>) | null;
  const { code, message, ...extra } = data?.error ?? {};
  return { ok: false, status: res.status, code: code ?? "error", message: message ?? PLAYLIST_COPY.learn.errors.unavailable, extra };
}

export async function loadLearn(): Promise<{ ok: true; list: LearnListView } | Refusal> {
  try {
    const res = await fetch("/api/playlist/learn", { credentials: "same-origin", cache: "no-store" });
    return res.ok ? { ok: true, list: (await res.json()) as LearnListView } : await refusalOf(res);
  } catch {
    return network;
  }
}

/** The test faults on the page's URL (`?faults=learn-limit`, `qloo`, …), passed on as the API header; the server honours them only when fault injection is allowed. */
export const pageFaults = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("faults"));

export type Streaming = { ok: true; events: AsyncGenerator<LearnStreamEvent> };

async function* parsed(body: NonNullable<Response["body"]>): AsyncGenerator<LearnStreamEvent> {
  for await (const line of ndjsonLines(body)) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    const event = learnStreamEventSchema.safeParse(value);
    if (event.success) yield event.data;
  }
}

/** Start a run. A refusal (404, 409, 429, 503) comes back as a Refusal; otherwise the events. */
export async function startLearn(faults: string | null): Promise<Streaming | Refusal> {
  try {
    const res = await fetch("/api/playlist/learn", { method: "POST", credentials: "same-origin", headers: faults ? { "x-buskmap-faults": faults } : undefined });
    if (!res.ok || !res.body) return await refusalOf(res);
    return { ok: true, events: parsed(res.body) };
  } catch {
    return network;
  }
}

/** Start a Repertoire research run (POST /api/playlist/research): a full run for a link, or "more". Same stream, same refusals. */
export async function startResearch(body: { link?: string; refresh?: boolean; mode?: "full" | "more"; qlooChoice?: { id: string } | { none: true }; genre?: string }, faults: string | null): Promise<Streaming | Refusal> {
  try {
    const res = await fetch("/api/playlist/research", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...(faults ? { "x-buskmap-faults": faults } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) return await refusalOf(res);
    return { ok: true, events: parsed(res.body) };
  } catch {
    return network;
  }
}

/** Answer a research run that waits for input (POST /api/playlist/research/<runId>/input): the same run carries on, streamed. */
export async function sendResearchInput(runId: string, body: { artists?: { name: string; spotifyId?: string }[]; genre?: string }, faults: string | null): Promise<Streaming | Refusal> {
  try {
    const res = await fetch(`/api/playlist/research/${encodeURIComponent(runId)}/input`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...(faults ? { "x-buskmap-faults": faults } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) return await refusalOf(res);
    return { ok: true, events: parsed(res.body) };
  } catch {
    return network;
  }
}

/** Join a run in flight, or replay a stored one. */
export async function joinLearn(runId: string): Promise<Streaming | Refusal> {
  try {
    const res = await fetch(`/api/playlist/learn/runs/${encodeURIComponent(runId)}/events`, { credentials: "same-origin", cache: "no-store" });
    if (!res.ok || !res.body) return await refusalOf(res);
    return { ok: true, events: parsed(res.body) };
  } catch {
    return network;
  }
}

export type PatchResult = { ok: true; suggestion: LearnSuggestionView; song: PlaylistSongView | null } | Refusal;

export async function patchSuggestion(id: string, status: PatchSuggestionInput["status"]): Promise<PatchResult> {
  try {
    const res = await fetch(`/api/playlist/learn/suggestions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return await refusalOf(res);
    const data = (await res.json()) as { suggestion: LearnSuggestionView; song: PlaylistSongView | null };
    return { ok: true, suggestion: data.suggestion, song: data.song };
  } catch {
    return network;
  }
}
