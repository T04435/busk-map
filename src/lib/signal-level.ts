/**
 * Each signal's level in plain words (V2 2.2): "Live data", "Estimate" or "Not checked", from the plan city's levels
 * (lib/city.ts cityLevels). Client-safe.
 *
 * Melbourne keeps today's labels ("Activity: est.", the council's rules), so a Melbourne plan gets no levels to label.
 */
import { cityLevels, DEFAULT_CITY_ID, type CityLevels } from "./city";

export type LevelSignal = keyof CityLevels;
export type LevelWord = "Live data" | "Estimate" | "Not checked";

/** The line a plan outside Melbourne shows wherever Melbourne's would speak of the council's rules (V2 2.4). */
export const RULES_NOT_CHECKED = "Local busking rules not checked: check with the city before you play.";

/** The levels to label on a plan: null in Melbourne (today's labels stay); else the stored levels, or the city's. */
export function levelsToLabel(city: string, stored: CityLevels | null = null): CityLevels | null {
  if (city === DEFAULT_CITY_ID) return null;
  return stored ?? cityLevels({ id: city });
}

/**
 * A signal's word. `none` is "Not checked"; activity is always Qloo's estimate; anything else is "Live data", but only when
 * its source answered live (`live`): test or missing data already says so beside it, so it gets no word.
 */
export function levelWord(signal: LevelSignal, levels: CityLevels | null, live = true): LevelWord | null {
  if (!levels) return null;
  const level = levels[signal];
  if (level === "none") return "Not checked";
  if (signal === "activity") return "Estimate";
  return live ? "Live data" : null;
}

/** Whether a plan's city has its own busking rules (Melbourne): elsewhere nothing is ruled in or out. */
export const rulesChecked = (levels: CityLevels | null): boolean => !levels || levels.rules !== "none";

/** The data source behind each signal, for whether it answered live. */
export const SIGNAL_SOURCE: Record<LevelSignal, string> = {
  taste: "qloo",
  activity: "qloo",
  events: "ticketmaster",
  weather: "open-meteo",
  rules: "melbourne-busking",
  pitches: "osm",
  hotspots: "busk-map",
};

/** Whether a signal's source answered live, from a plan's data status (a source the plan never asked counts as not live). */
export function liveSource(signal: LevelSignal, status: { source: string; mode: string }[]): boolean {
  const source = SIGNAL_SOURCE[signal];
  return status.some((s) => s.source === source && s.mode === "live");
}
