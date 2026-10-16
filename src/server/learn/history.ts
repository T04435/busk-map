import "server-only";
import { nameKey } from "@/lib/text";
import { LEARN_HISTORY_TOKENS } from "@/server/playlist/config";
import type { LearnStore } from "./store";
import type { HistoryData } from "./types";

/**
 * The history of earlier runs, for the prompt and for the no-repeat filter (docs/playlist-architecture.md §2.8).
 *
 * The block in the prompt is guidance only and is truncated to a token budget. No-repeat is enforced on the FULL
 * history whatever the truncation: `historyKeys` covers every song key, and top_tracks, checkPicks and the unique
 * index all use it.
 */
export async function loadHistory(store: LearnStore, playlistId: string): Promise<HistoryData> {
  return store.history(playlistId);
}

/** Every key the run must never offer again, by reason. A dismissed song counts as dismissed even if the size cap removed its row. */
export type HistoryKeys = { dismissed: Set<string>; suggested: Set<string>; known: Set<string> };

export function historyKeys(history: HistoryData): HistoryKeys {
  const dismissed = new Set(history.dismissedKeys);
  const suggested = new Set<string>();
  for (const s of history.suggestions) (s.status === "dismissed" ? dismissed : suggested).add(s.key);
  const known = new Set(history.songs.map((s) => s.key));
  return { dismissed, suggested, known };
}

/** Why a song key is left out, by the priority top_tracks reports it: dismissed, then suggested before, then already sung. */
export function leftOutReason(keys: HistoryKeys, songKey: string): "dismissed" | "alreadySuggested" | "alreadyKnown" | null {
  if (keys.dismissed.has(songKey)) return "dismissed";
  if (keys.suggested.has(songKey)) return "alreadySuggested";
  if (keys.known.has(songKey)) return "alreadyKnown";
  return null;
}

/** Artists with this many songs or more across the Repertoire (sung, learned, pending) get no more picks. */
export function songsPerArtist(history: HistoryData): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (artist: string) => counts.set(nameKey(artist), (counts.get(nameKey(artist)) ?? 0) + 1);
  for (const s of history.songs) add(s.artist);
  for (const s of history.suggestions) if (s.status === "pending") add(s.artist);
  return counts;
}

/** The Learned list: what a pick may say it "builds on". */
export function learnedSongs(history: HistoryData): { title: string; artist: string }[] {
  return [
    ...history.songs.filter((s) => s.state === "learned"),
    ...history.suggestions.filter((s) => s.status === "learned"),
  ].map((s) => ({ title: s.title, artist: s.artist }));
}

const clean = (text: string) => text.replace(/[\r\n\t|]+/g, " ").replace(/\s+/g, " ").trim();
const dateFormat = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" });
const dateYearFormat = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Melbourne" });
const day = (at: number) => dateFormat.format(at);

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

type Limits = { pending: number; dismissed: number; perArtist: number | "artists"; learned: number };
/** Truncation, in the order the doc applies it (§2.8). Each level keeps the one before it. */
const LEVELS: Limits[] = [
  { pending: Infinity, dismissed: Infinity, perArtist: Infinity, learned: Infinity },
  { pending: 20, dismissed: Infinity, perArtist: Infinity, learned: Infinity },
  { pending: 20, dismissed: 20, perArtist: Infinity, learned: Infinity },
  { pending: 20, dismissed: 20, perArtist: 2, learned: Infinity },
  { pending: 20, dismissed: 20, perArtist: 2, learned: 10 },
  { pending: 20, dismissed: 20, perArtist: "artists", learned: 10 },
];

function render(history: HistoryData, limits: Limits): string {
  const lines: string[] = [];
  const sung = history.songs.filter((s) => s.state === "can_sing");
  if (sung.length) {
    const byArtist = new Map<string, string[]>();
    for (const s of sung) byArtist.set(clean(s.artist), [...(byArtist.get(clean(s.artist)) ?? []), clean(s.title)]);
    const groups = [...byArtist].map(([artist, titles]) => {
      if (limits.perArtist === "artists") return `${artist} (${titles.length})`;
      const shown = titles.slice(0, limits.perArtist === Infinity ? titles.length : limits.perArtist);
      const more = titles.length - shown.length;
      return `${artist}: ${shown.join(", ")}${more > 0 ? ` +${more}` : ""}`;
    });
    lines.push(`Songs you can sing (${sung.length}): ${groups.join(" | ")}`);
  } else {
    lines.push("Songs you can sing (0): none");
  }

  const where = (s: HistoryData["suggestions"][number]) => `${clean(s.artist)}, ${s.runNumber ? `run ${s.runNumber}, ` : "from a plan, "}${day(s.at)}`;
  const learnedKeys = new Set(history.suggestions.filter((s) => s.status === "learned").map((s) => s.key));
  const learned = [
    ...history.suggestions.filter((s) => s.status === "learned").map((s) => `${clean(s.title)} (${where(s)})`),
    // Marked learned in the Repertoire without a suggestion row (or after it was capped): no run to name.
    ...history.songs.filter((s) => s.state === "learned" && !learnedKeys.has(s.key)).map((s) => `${clean(s.title)} (${clean(s.artist)})`),
  ];
  if (learned.length) {
    const shown = learned.slice(0, limits.learned);
    lines.push(`Learned from earlier runs (${learned.length}): ${shown.join(" | ")}${learned.length > shown.length ? ` | and ${learned.length - shown.length} more` : ""}`);
  }

  const pending = history.suggestions.filter((s) => s.status === "pending");
  if (pending.length) {
    const shown = pending.slice(0, limits.pending);
    lines.push(`On your To learn list, not learned yet (${pending.length}): ${shown.map((s) => `${clean(s.title)} (${where(s)})`).join(" | ")}${pending.length > shown.length ? ` | and ${pending.length - shown.length} more` : ""}`);
  }

  const dismissed = history.suggestions.filter((s) => s.status === "dismissed");
  const dismissedTotal = dismissed.length + history.dismissedKeys.length;
  if (dismissedTotal) {
    const shown = dismissed.slice(0, limits.dismissed);
    const hidden = dismissedTotal - shown.length;
    let tail = "";
    if (hidden > 0) {
      const counts = new Map<string, number>();
      for (const s of dismissed.slice(shown.length)) counts.set(clean(s.artist), (counts.get(clean(s.artist)) ?? 0) + 1);
      const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([artist]) => artist);
      tail = ` | and ${hidden} more${top.length ? `, mostly by ${top.join(", ")}` : ""}`;
    }
    lines.push(`Dismissed, never suggest again (${dismissedTotal}): ${shown.map((s) => `${clean(s.title)} (${clean(s.artist)})`).join(" | ")}${tail}`);
  }

  if (history.earlierRuns > 0 && history.lastRun) {
    lines.push(`Earlier runs: ${history.earlierRuns}. Last run: ${dateYearFormat.format(history.lastRun.startedAt)} (run ${history.lastRun.number}, ${history.lastRun.newCount} new).`);
  } else {
    lines.push("Earlier runs: none. This is the first run.");
  }
  return lines.join("\n");
}

export type FormattedHistory = { text: string; tokens: number; level: number };

/**
 * The compact block for the prompt, within `budgetTokens` (characters ÷ 4). Most recent first within each group.
 * Truncation is applied level by level until it fits: To learn (newest 20), Dismissed (newest 20), Songs you can sing
 * (2 titles per artist), then Learned (never below the newest 10).
 */
export function formatHistory(history: HistoryData, budgetTokens = LEARN_HISTORY_TOKENS): FormattedHistory {
  let text = "";
  let level = 0;
  for (; level < LEVELS.length; level++) {
    text = render(history, LEVELS[level]);
    if (estimateTokens(text) <= budgetTokens) break;
  }
  return { text, tokens: estimateTokens(text), level: Math.min(level, LEVELS.length - 1) };
}
