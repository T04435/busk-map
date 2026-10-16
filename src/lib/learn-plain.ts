/**
 * A learn run's steps in plain words (docs/playlist-architecture.md §7.1): what each tool found, built from the output
 * fields the table there lists, with no tool names, endpoints, ids or JSON. The raw view (tool name, source, inputs, the
 * data returned) is a separate switch. Looked up by stream kind and tool, because `crowd_at` also exists in the busk agent
 * with a different output. Pure and client-safe.
 */
import type { AgentStep } from "./agent-steps";
import { LEARN_TOOL_LABELS } from "./learn-tools";

export type PlainStep = {
  /** The card's main line: "Matched your 9 songs to 6 artists on Qloo". */
  headline: string;
  /** Short extra lines under it (artists, what Qloo couldn't match). */
  lines: string[];
  /** Small "because" chips: "Fans of Dolly Parton like them". */
  chips: string[];
  /** The step has finished but the result isn't what was wanted: the finishing tool sent back, or a look that failed. */
  problem: boolean;
};

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.filter(isRow) : []);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const text = (v: unknown) => (typeof v === "string" ? v : "");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const names = (v: unknown, max = 4) => {
  const all = rows(v).map((r) => text(r.name)).filter(Boolean);
  return all.length > max ? `${all.slice(0, max).join(", ")} and ${all.length - max} more` : all.join(", ");
};

/** The words for a step that hasn't produced output yet: the tool's label, e.g. "Matching your songs on Qloo". */
export const runningLine = (step: Pick<AgentStep, "tool" | "label">) => (step.tool ? (LEARN_TOOL_LABELS[step.tool] ?? step.label) : step.label);

export function plainStep(step: Pick<AgentStep, "tool" | "status" | "summary" | "output">): PlainStep {
  const out = isRow(step.output) ? step.output : {};
  const done = (headline: string, lines: string[] = [], chips: string[] = []): PlainStep => ({ headline, lines: lines.filter(Boolean), chips, problem: false });
  const tool = step.tool ?? "";
  if (step.status === "running") return done(runningLine({ tool: step.tool, label: "" }));
  if (typeof out.skipped === "string") return done("Skipped: this run's Qloo requests are used up, so it works with what it has");
  if (step.status === "failed" && tool !== "finish_suggestions") return { headline: "That look didn't work, so we moved on", lines: [], chips: [], problem: true };

  switch (tool) {
    case "match_playlist": {
      const artists = rows(out.artists);
      const matched = artists.filter((a) => a.matched === true).length;
      const unmatched = Array.isArray(out.unmatched) ? out.unmatched.map(text).filter(Boolean) : [];
      const songs = num(out.songs);
      if (matched === 0) return { headline: "Qloo couldn't match any of your artists", lines: [], chips: [], problem: true };
      return done(`Matched your ${plural(songs, "song")} to ${plural(matched, "artist")} on Qloo`, unmatched.length ? [`Qloo couldn't match: ${unmatched.join(", ")}`] : []);
    }
    case "history": {
      const earlier = num(out.earlierRuns);
      if (earlier === 0) return done("No earlier runs: this is your first");
      return done(`${plural(earlier, "earlier run")}: ${num(out.learned)} learned, ${num(out.pending)} to learn, ${num(out.dismissed)} dismissed`);
    }
    case "crowd_at": {
      const pitch = text(out.pitch);
      const where = !pitch || pitch === "city" ? "the city centre" : pitch;
      const artists = rows(out.artists);
      if (artists.length === 0) return done(`Qloo has no crowd data for ${where}`);
      const because = artists.flatMap((a) => (Array.isArray(a.because) ? a.because.map(text) : [])).filter(Boolean);
      return done(`Read the crowd at ${where}`, [`Top artists: ${names(artists, 4)}`], [...new Set(because)].slice(0, 3));
    }
    case "related_artists": {
      const artists = rows(out.artists);
      if (artists.length === 0) return done("Qloo found no related artists");
      const inRepertoire = artists.filter((a) => a.alreadyInPlaylist === true).map((a) => text(a.name));
      return done(`Found ${plural(artists.length, "artist")} your fans also like`, [names(artists, 5), inRepertoire.length ? `Already in your Repertoire: ${inRepertoire.join(", ")}` : ""]);
    }
    case "rising": {
      const artists = rows(out.artists);
      const moving = artists.filter((a) => num(a.trendDelta) !== 0);
      const arrow = (a: Row) => `${text(a.name)} ${num(a.trendDelta) > 0 ? "↑" : "↓"}`;
      if (out.window === null || out.window === undefined) return done("Qloo has no recent trending data for these artists");
      return done("Checked who's rising with those crowds", moving.length ? [moving.map(arrow).join(", ")] : ["No movement in Qloo's latest trending data"]);
    }
    case "crowd_profile": {
      const lean = text(out.ageLean);
      return done(lean ? `Your fans lean ${lean}` : "No clear age lean in Qloo's data");
    }
    case "top_tracks": {
      // The server's own sentence is already plain ("Picked top tracks on Spotify (Last.fm for 1). Left out 5 songs suggested before and 2 you dismissed").
      const s = text(out.summary) || text(step.summary);
      return done(s ? (/[.:]$/.test(s) ? s : `${s}.`) : "Picked top tracks");
    }
    case "finish_suggestions": {
      if (out.accepted === true) return done(text(out.summary) || "Ranked your songs and wrote why");
      const problems = Array.isArray(out.problems) ? out.problems.map(text).filter(Boolean) : [];
      return { headline: `Sent back: ${problems[0] ?? "the picks needed fixing"} (fixing)`, lines: problems.slice(1), chips: [], problem: true };
    }
    default:
      return done(text(step.summary) || "Done");
  }
}

/** The funnel of a run (sketch §2): counts left to right, with ONE "left out" count. `songs` are the songs it checked. */
export function funnelOf(t: { qlooCalls?: number; artists: number; crowds: number; liked: number; songsChecked: number; alreadySuggested: number; dismissedSkipped: number; alreadyKnown: number; newSongs: number }) {
  const leftOut = t.alreadySuggested + t.dismissedSkipped + t.alreadyKnown;
  return [
    { key: "qlooCalls", value: t.qlooCalls ?? 0, label: t.qlooCalls === 1 ? "Qloo call" : "Qloo calls" },
    { key: "artists", value: t.artists, label: t.artists === 1 ? "artist matched" : "artists matched" },
    { key: "crowds", value: t.crowds, label: t.crowds === 1 ? "crowd read" : "crowds read" },
    { key: "liked", value: t.liked, label: t.liked === 1 ? "artist liked" : "artists liked" },
    { key: "songsChecked", value: t.songsChecked, label: t.songsChecked === 1 ? "song checked" : "songs checked" },
    { key: "leftOut", value: leftOut, label: "left out" },
    { key: "newSongs", value: t.newSongs, label: t.newSongs === 1 ? "new song" : "new songs" },
  ] as const;
}
