/**
 * Research totals: how much data a plan's research used, for the design's
 * ResearchFunnel. Computed once when the plan is assembled and kept on the
 * plan itself, so replays and stored plans return them as they were.
 *
 * Agent plans count from the run's tool outputs (`fromToolOutputs`); engine-only
 * plans (no agent, the agent failed or fell back, run=0) count from the
 * engine's own data (`fromEngine`). Pure: no I/O. A failed or absent tool
 * counts 0. Every field is a non-negative integer.
 *
 * Field definitions (agent run):
 * - taste:   Qloo taste-map cells mapped: the `cells` count each successful
 *            taste_map call reported, summed over distinct maps (same signals
 *            and area counted once).
 * - crowds:  crowd reads: distinct crowd_at reads (point and radius) that
 *            returned at least one artist.
 * - places:  distinct busy places found (by name) across busy_places calls.
 * - events:  distinct events found (name, venue, start) across events_near calls.
 * - sensors: distinct pedestrian sensors with a reading (peopleThisHour) across
 *            footfall_at calls.
 * - rules:   council rules checks: distinct spots check_pitch ran the council
 *            layers on (not when the rules were unavailable), plus every pitch
 *            in the final scored pool (each passed the engine's legality filter).
 * - scored:  pitches scored: poolSize of the last successful score_pitches.
 * - songs:   distinct songs ordered (song, artist) across build_setlist calls.
 *
 * Engine-only plans use the same meaning with the engine's data: taste = the
 * heatmap's cells; crowds = the crowd reads with data (the performer's crowd,
 * the usual-hotspot crowd); places and events = distinct ones in the scored
 * pool's evidence; sensors = slot sensors with a reading; rules = scored = the
 * scored pool; songs = distinct songs across the plan's setlists.
 */
import { z } from "zod";
import { nameKey } from "./text";

const count = z.number().int().min(0);

export const researchTotalsSchema = z.object({
  taste: count,
  crowds: count,
  places: count,
  events: count,
  sensors: count,
  rules: count,
  scored: count,
  songs: count,
});

export type ResearchTotals = z.infer<typeof researchTotalsSchema>;

export const ZERO_TOTALS: ResearchTotals = { taste: 0, crowds: 0, places: 0, events: 0, sensors: 0, rules: 0, scored: 0, songs: 0 };

/** One finished tool call, as the step stream records it (tool-end). */
export type ToolResult = { tool: string; ok: boolean; output?: unknown };

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.filter(isRow) : []);
const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const key = (v: unknown) => nameKey(str(v));
const nonNegInt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Successful outputs of one tool (an error output, a rejected call or a missing output is skipped). */
function outputsOf(results: ToolResult[], tool: string): Row[] {
  return results.filter((r) => r.tool === tool && r.ok && isRow(r.output) && !("error" in r.output)).map((r) => r.output as Row);
}

/** Totals from an agent run's tool outputs (taken before any pruning). */
export function fromToolOutputs(results: ToolResult[]): ResearchTotals {
  const maps = new Map<string, number>();
  for (const o of outputsOf(results, "taste_map")) {
    const signals = Array.isArray(o.signals) ? o.signals.map(key).sort() : [];
    const id = JSON.stringify([signals, o.area ?? null]);
    maps.set(id, Math.max(maps.get(id) ?? 0, nonNegInt(o.cells)));
  }

  const crowds = new Set<string>();
  for (const o of outputsOf(results, "crowd_at")) {
    if (rows(o.artists).length === 0) continue;
    const at = isRow(o.at) ? o.at : {};
    crowds.add(JSON.stringify([str(at.lat), str(at.lon), str(o.radiusM)]));
  }

  const places = new Set<string>();
  for (const o of outputsOf(results, "busy_places")) for (const p of rows(o.places)) if (key(p.name)) places.add(key(p.name));

  const events = new Set<string>();
  for (const o of outputsOf(results, "events_near")) for (const e of rows(o.events)) if (key(e.name)) events.add(JSON.stringify([key(e.name), key(e.venue), str(e.starts)]));

  const sensors = new Set<string>();
  for (const o of outputsOf(results, "footfall_at")) {
    for (const s of rows(o.sensors)) if (key(s.sensor) && typeof s.peopleThisHour === "number") sensors.add(key(s.sensor));
  }

  const checked = new Set<string>();
  for (const o of outputsOf(results, "check_pitch")) {
    if (o.legal === "unknown") continue;
    const id = str(o.pitchId) || key(o.name);
    if (id) checked.add(id);
  }

  const scoring = outputsOf(results, "score_pitches");
  const scored = scoring.length ? nonNegInt(scoring[scoring.length - 1].poolSize) : 0;

  const songs = new Set<string>();
  for (const o of outputsOf(results, "build_setlist")) for (const s of rows(o.songs)) if (key(s.song)) songs.add(JSON.stringify([key(s.song), key(s.artist)]));

  return {
    taste: [...maps.values()].reduce((a, b) => a + b, 0),
    crowds: crowds.size,
    places: places.size,
    events: events.size,
    sensors: sensors.size,
    rules: checked.size + scored,
    scored,
    songs: songs.size,
  };
}

/** The engine's data behind a plan, for engine-only plans. */
export type EngineResearch = {
  /** Qloo heatmap cells over the city. */
  cells: number;
  /** Crowd reads that returned artists (e.g. the performer's crowd, the usual-hotspot crowd). */
  crowdReads: number;
  /** The scored pool: each pitch's evidence (places, events). */
  pool: { evidence: { places: { name: string }[]; events: { name: string; venue: string | { name: string }; start?: string; localTime?: string | null }[] } }[];
  /** Slot sensors, with their reading (null: none). */
  sensors: { id?: string | number; name: string; avgHourly: number | null }[];
  /** The plan's setlists. */
  setlists: { title: string; artist: string }[][];
};

/** Totals from the engine's data (agent not used). */
export function fromEngine(data: EngineResearch): ResearchTotals {
  const places = new Set<string>();
  const events = new Set<string>();
  for (const p of data.pool) {
    for (const place of p.evidence.places) if (key(place.name)) places.add(key(place.name));
    for (const e of p.evidence.events) {
      const venue = typeof e.venue === "string" ? e.venue : e.venue.name;
      if (key(e.name)) events.add(JSON.stringify([key(e.name), key(venue), str(e.start ?? e.localTime)]));
    }
  }
  const sensors = new Set(data.sensors.filter((s) => typeof s.avgHourly === "number").map((s) => str(s.id ?? s.name) || key(s.name)));
  const songs = new Set(data.setlists.flat().map((s) => JSON.stringify([key(s.title), key(s.artist)])));
  const scored = data.pool.length;
  return {
    taste: nonNegInt(data.cells),
    crowds: nonNegInt(data.crowdReads),
    places: places.size,
    events: events.size,
    sensors: sensors.size,
    rules: scored,
    scored,
    songs: songs.size,
  };
}
