/**
 * The week's spread rule (hard): the days' picks never bunch up.
 * - A metro (planned in named areas or districts): each day's pick comes from an area no other day uses, while that day has a
 *   scored pitch in an unused area. Only when every area is used may one repeat: then the least-used one, never the area of the
 *   day before.
 * - A city without areas (Melbourne, a CBD-sized city): never the same pitch twice, and each pick at least WEEK_MIN_SPACING_M
 *   from every earlier day's pick; relaxed only when that day has no scored pitch that keeps it.
 * finish_week checks it (spreadProblems) and the engine enforces it on the accepted answer (enforceSpread), so it holds even if
 * the model insists. Pure: the tests call it directly.
 */
import { distanceM, type LatLon } from "@/lib/geo";

/** Every day's pick at least this far from every earlier day's (a city without areas). */
export const WEEK_MIN_SPACING_M = 400;

export type SpreadPitch = LatLon & { id: string; name: string; score: number };
/** One playable day: its scored pool and, for a metro, the area a pitch is in (null: a city without areas). */
export type SpreadDay = { pool: readonly SpreadPitch[]; areaOf: ((p: LatLon) => string | null) | null };
export type SpreadPick = { day: string; pitchId: string | null; why: string };

type Earlier = { day: string; pitch: SpreadPitch; area: string | null };

const areaKey = (day: SpreadDay, p: SpreadPitch) => (day.areaOf ? (day.areaOf(p) ?? `pitch:${p.id}`) : null);
const byScore = (a: SpreadPitch, b: SpreadPitch) => b.score - a.score || a.id.localeCompare(b.id);

/**
 * The rules a pick must keep on this day, strictest first; the first one any pitch of the pool keeps is the one that applies
 * (the rule relaxes only when nothing keeps it).
 */
function tiers(day: SpreadDay, earlier: readonly Earlier[]): ((p: SpreadPitch) => boolean)[] {
  if (day.areaOf) {
    const uses = new Map<string, number>();
    for (const e of earlier) if (e.area) uses.set(e.area, (uses.get(e.area) ?? 0) + 1);
    const previous = earlier.at(-1)?.area ?? null;
    const poolAreas = [...new Set(day.pool.map((p) => areaKey(day, p)!))];
    const fewest = Math.min(...poolAreas.map((a) => uses.get(a) ?? 0));
    const area = (p: SpreadPitch) => areaKey(day, p)!;
    return [
      (p) => !uses.has(area(p)),
      (p) => (uses.get(area(p)) ?? 0) === fewest && area(p) !== previous,
      (p) => area(p) !== previous,
      () => true,
    ];
  }
  const ids = new Set(earlier.map((e) => e.pitch.id));
  return [(p) => !ids.has(p.id) && earlier.every((e) => distanceM(e.pitch, p) >= WEEK_MIN_SPACING_M), (p) => !ids.has(p.id), () => true];
}

/** The rule that applies to this day, given the earlier days' picks. */
function ruleFor(day: SpreadDay, earlier: readonly Earlier[]) {
  return tiers(day, earlier).find((t) => day.pool.some(t)) ?? (() => true);
}

/** The best pitches of the day that keep the rule. */
export function allowedPitches(day: SpreadDay, earlier: readonly Earlier[]): SpreadPitch[] {
  const rule = ruleFor(day, earlier);
  return day.pool.filter(rule).sort(byScore);
}

/** Walk the answer's picks in date order, with each day's earlier picks. */
function walk(answer: readonly SpreadPick[], days: ReadonlyMap<string, SpreadDay>, visit: (pick: SpreadPick, day: SpreadDay, chosen: SpreadPitch, earlier: Earlier[]) => SpreadPitch) {
  const earlier: Earlier[] = [];
  for (const pick of [...answer].sort((a, b) => a.day.localeCompare(b.day))) {
    const day = days.get(pick.day);
    const chosen = pick.pitchId === null ? undefined : day?.pool.find((p) => p.id === pick.pitchId);
    if (!day || !chosen) continue;
    const kept = visit(pick, day, chosen, earlier);
    earlier.push({ day: pick.day, pitch: kept, area: areaKey(day, kept) });
  }
}

/**
 * The picks that break the rule, each with a reason naming what is used and the day's best allowed pitches (counted as if each
 * earlier broken day took its first suggestion: the suggestions together keep the rule).
 */
export function spreadProblems(answer: readonly SpreadPick[], days: ReadonlyMap<string, SpreadDay>): string[] {
  const problems: string[] = [];
  walk(answer, days, (pick, day, chosen, earlier) => {
    const allowed = allowedPitches(day, earlier);
    if (allowed.some((p) => p.id === chosen.id)) return chosen;
    const tryThese = `Try ${pick.day}: ${allowed.slice(0, 3).map((p) => p.id).join(", ")}.`;
    if (day.areaOf) {
      const area = areaKey(day, chosen)!;
      const usedOn = earlier.filter((e) => e.area === area).map((e) => e.day);
      const used = [...new Set(earlier.map((e) => e.area).filter((a): a is string => a !== null && !a.startsWith("pitch:")))];
      problems.push(
        `${pick.day}'s pick ${chosen.id} is in ${area.startsWith("pitch:") ? "an area" : area}, already used on ${usedOn.join(", ") || "the day before"}. Areas used so far: ${used.join(", ") || "none"}. Each day takes an area no other day uses while one with a scored pitch is left. ${tryThese}`,
      );
    } else {
      const same = earlier.find((e) => e.pitch.id === chosen.id);
      const near = earlier.find((e) => distanceM(e.pitch, chosen) < WEEK_MIN_SPACING_M);
      problems.push(
        same
          ? `${pick.day}'s pick ${chosen.id} is already ${same.day}'s pick: never the same pitch twice in a week. ${tryThese}`
          : `${pick.day}'s pick ${chosen.id} is within ${WEEK_MIN_SPACING_M} m of ${near?.day}'s pick (${near?.pitch.name}): each day at least ${WEEK_MIN_SPACING_M} m from every other. ${tryThese}`,
      );
    }
    // The later days are checked against this day's first suggestion, so taking every suggestion at once keeps the rule.
    return allowed[0] ?? chosen;
  });
  return problems;
}

/**
 * The answer with the rule enforced: a pick that breaks it is replaced by the day's best allowed pitch, its why left empty (the
 * plan then writes its reason from the data). The days that changed are returned too.
 */
export function enforceSpread<T extends SpreadPick>(answer: readonly T[], days: ReadonlyMap<string, SpreadDay>): { picks: T[]; changed: string[] } {
  const replaced = new Map<string, SpreadPitch>();
  walk(answer, days, (pick, day, chosen, earlier) => {
    const allowed = allowedPitches(day, earlier);
    if (allowed.some((p) => p.id === chosen.id) || allowed.length === 0) return chosen;
    replaced.set(pick.day, allowed[0]);
    return allowed[0];
  });
  return {
    picks: answer.map((p) => (replaced.has(p.day) ? { ...p, pitchId: replaced.get(p.day)!.id, why: "" } : p)),
    changed: [...replaced.keys()],
  };
}
