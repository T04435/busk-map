/**
 * Learn totals: how much a learn run looked at, for the funnel on /repertoire. Counted over the finished tool calls so
 * far (docs/playlist-architecture.md §2.7), sent after each tool-end and once more before `end`. Pure: no I/O. A failed
 * or absent tool counts 0; every field is a non-negative integer.
 *
 * - artists:           seed artists matched on Qloo (match_playlist).
 * - crowds:            distinct crowd_at reads (by pitch) that returned at least one artist.
 * - liked:             distinct artists found across related_artists and crowd_at, excluding the ones already in the Repertoire.
 * - songsChecked:      distinct songs top_tracks looked at, before filtering.
 * - alreadySuggested:  songs top_tracks left out because they were suggested before (pending or learned).
 * - dismissedSkipped:  songs left out because you dismissed them.
 * - alreadyKnown:      songs left out because they are in Songs you can sing.
 * - newSongs:          suggestions saved by this run: 0 until the run is accepted, then the final count (`extra`).
 * - qlooCalls, qlooCacheHits: from the run's Qloo counter (adapters/qloo/usage.ts), passed in `extra`.
 */
import { ZERO_LEARN_TOTALS, type LearnTotals } from "./learn-schema";
import type { ToolResult } from "./research-totals";

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.filter(isRow) : []);
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));

/** Successful outputs of one tool (an error output, a rejected call, a Qloo budget skip (`skipped: "budget"`) or a missing output is left out). */
function outputsOf(results: ToolResult[], tool: string): Row[] {
  return results.filter((r) => r.tool === tool && r.ok && isRow(r.output) && !("error" in r.output) && typeof r.output.skipped !== "string").map((r) => r.output as Row);
}

export function fromLearnOutputs(results: ToolResult[], extra: Partial<Pick<LearnTotals, "newSongs" | "qlooCalls" | "qlooCacheHits">> = {}): LearnTotals {
  const matched = outputsOf(results, "match_playlist").at(-1);
  const artists = rows(matched?.artists).filter((a) => a.matched === true).length;

  const crowds = new Set<string>();
  for (const o of outputsOf(results, "crowd_at")) if (rows(o.artists).length > 0) crowds.add(str(o.pitch));

  const liked = new Set<string>();
  for (const tool of ["related_artists", "crowd_at"]) {
    for (const o of outputsOf(results, tool)) for (const a of rows(o.artists)) if (a.alreadyInPlaylist !== true && str(a.artistId)) liked.add(str(a.artistId));
  }

  let songsChecked = 0;
  let alreadySuggested = 0;
  let dismissedSkipped = 0;
  let alreadyKnown = 0;
  for (const o of outputsOf(results, "top_tracks")) {
    const skipped = isRow(o.skipped) ? o.skipped : {};
    songsChecked += count(o.checked);
    alreadySuggested += count(skipped.alreadySuggested);
    dismissedSkipped += count(skipped.dismissed);
    alreadyKnown += count(skipped.canSing);
  }

  return {
    ...ZERO_LEARN_TOTALS,
    artists,
    crowds: crowds.size,
    liked: liked.size,
    songsChecked,
    alreadySuggested,
    dismissedSkipped,
    alreadyKnown,
    newSongs: extra.newSongs ?? 0,
    qlooCalls: extra.qlooCalls ?? 0,
    qlooCacheHits: extra.qlooCacheHits ?? 0,
  };
}
