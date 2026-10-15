/**
 * Example tip-log sessions for the example performers. Illustrative only:
 * invented takings, never real data, and labelled "Example data" wherever
 * they appear. They show how logged takings nudge future plans.
 */
import { EXAMPLES } from "./examples";
import { performerKeyFor, summarizeTips, type TipEntry, type TipHistory } from "./tips";

type Seed = [date: string, pitchId: string, pitchName: string, startHour: number, endHour: number, amount: number];

const SEEDS: Record<string, Seed[]> = {
  // Saturday evenings. Best at Albert Coates Lane (in the live plan's top three), then Centre Place.
  acoustic: [
    ["2026-10-10", "spot:osm:albert-coates-lane", "Albert Coates Lane", 18, 21, 165],
    ["2026-10-03", "spot:osm:alfred-place", "Alfred Place", 18, 21, 84],
    ["2026-09-26", "spot:osm:albert-coates-lane", "Albert Coates Lane", 18, 21, 180],
    ["2026-09-19", "spot:osm:centre-place", "Centre Place", 18, 21, 170],
    ["2026-09-12", "spot:osm:alfred-place", "Alfred Place", 18, 21, 75],
    ["2026-09-05", "spot:osm:centre-place", "Centre Place", 18, 21, 165],
    ["2026-08-29", "spot:osm:albert-coates-lane", "Albert Coates Lane", 18, 21, 150],
    ["2026-08-22", "spot:osm:federation-wharf", "Federation Wharf", 18, 21, 60],
    ["2026-08-15", "spot:osm:centre-place", "Centre Place", 18, 21, 160],
  ],
  // Friday after work. Best at Cohen Place Plaza, then City Square.
  sax: [
    ["2026-10-09", "spot:osm:cohen-place-plaza", "Cohen Place Plaza", 17, 20, 165],
    ["2026-10-02", "spot:osm:lindsay-forecourt", "Lindsay Forecourt", 17, 20, 90],
    ["2026-09-25", "spot:osm:cohen-place-plaza", "Cohen Place Plaza", 17, 20, 190],
    ["2026-09-18", "spot:osm:city-square", "City Square", 17, 20, 165],
    ["2026-09-11", "spot:osm:lindsay-forecourt", "Lindsay Forecourt", 17, 20, 84],
    ["2026-09-04", "spot:osm:city-square", "City Square", 17, 20, 156],
    ["2026-08-28", "spot:osm:cohen-place-plaza", "Cohen Place Plaza", 17, 20, 150],
    ["2026-08-21", "spot:osm:madame-brussels-lane", "Madame Brussels Lane", 17, 20, 60],
    ["2026-08-14", "spot:osm:southern-cross-lane", "Southern Cross Lane", 18, 20, 40],
  ],
  // Sunday afternoons. Best at Federation Wharf, then Centre Place.
  "folk-duo": [
    ["2026-10-11", "spot:osm:federation-wharf", "Federation Wharf", 12, 15, 210],
    ["2026-10-04", "spot:osm:university-square", "University Square", 12, 15, 105],
    ["2026-09-27", "spot:osm:federation-wharf", "Federation Wharf", 12, 15, 186],
    ["2026-09-20", "spot:osm:centre-place", "Centre Place", 12, 15, 225],
    ["2026-09-13", "spot:osm:university-square", "University Square", 12, 15, 99],
    ["2026-09-06", "spot:osm:centre-place", "Centre Place", 12, 15, 210],
    ["2026-08-30", "spot:osm:federation-wharf", "Federation Wharf", 12, 15, 240],
    ["2026-08-23", "spot:osm:lincoln-square", "Lincoln Square", 12, 15, 75],
    ["2026-08-16", "spot:osm:centre-place", "Centre Place", 12, 15, 205],
  ],
};

export const EXAMPLE_TIPS: TipEntry[] = EXAMPLES.flatMap((example) =>
  (SEEDS[example.id] ?? []).map(([date, pitchId, pitchName, startHour, endHour, amount], i) => ({
    id: `example-${example.id}-${i}`,
    performerKey: performerKeyFor(example.performer.name, example.id),
    performerName: example.performer.name,
    pitchId,
    pitchName,
    date,
    startHour,
    endHour,
    amount,
    example: true,
  })),
);

export function exampleTipsFor(exampleId: string): TipEntry[] {
  return examplesForKey(performerKeyFor("", exampleId));
}

/** The history an example plan uses when the browser has nothing to add. */
export function exampleHistory(exampleId: string | null | undefined): TipHistory | undefined {
  return exampleId ? (summarizeTips(exampleTipsFor(exampleId)) ?? undefined) : undefined;
}

/** Example sessions for a performer key ("example:<id>"); none for an own act. */
export function examplesForKey(performerKey: string): TipEntry[] {
  return EXAMPLE_TIPS.filter((e) => e.performerKey === performerKey);
}
