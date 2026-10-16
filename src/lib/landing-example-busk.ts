/**
 * The made-up example busk the landing shows through the real PlanMap and PitchRow: three pitches on a hex-lattice of taste
 * cells around the Melbourne CBD. It is example data (the landing says so), not a plan from Qloo.
 */
import type { Plan, PlanPitch } from "@/lib/plan-schema";

export const EXAMPLE_CENTER = { lat: -37.8165, lon: 144.9645 };

export const EXAMPLE_PITCHES: (Pick<PlanPitch, "id" | "name" | "lat" | "lon" | "score" | "discovery"> & { when: string })[] = [
  { id: "ex-southbank", name: "Southbank Promenade", lat: -37.8206, lon: 144.9657, score: 91, discovery: "hidden-gem", when: "12–3 pm" },
  { id: "ex-hardware", name: "Hardware Lane", lat: -37.8138, lon: 144.9606, score: 84, discovery: "hidden-gem", when: "12–3 pm" },
  { id: "ex-degraves", name: "Degraves Street", lat: -37.8172, lon: 144.9665, score: 78, discovery: "usual", when: "12–3 pm" },
];

export const EXAMPLE_OTHERS: Plan["others"] = [
  { id: "ex-o1", name: "Federation Square", lat: -37.8179, lon: 144.9691, score: 66, kind: "public-space", discovery: "usual", tipPoints: null, tooCloseTo: null },
  { id: "ex-o2", name: "Howey Place", lat: -37.8151, lon: 144.9669, score: 61, kind: "footpath", discovery: null, tipPoints: null, tooCloseTo: null },
];

// Hot spots (lat, lon, strength): where this example crowd gathers.
const HEAT: [number, number, number][] = [
  [-37.8206, 144.9657, 1],
  [-37.8138, 144.9606, 0.78],
  [-37.8172, 144.9665, 0.62],
  [-37.8112, 144.9712, 0.4],
];

/** A pointy-top hex lattice about 3 km wide, affinity from the hot spots (0–1). */
export const EXAMPLE_TASTE_CELLS: Plan["tasteCells"] = (() => {
  const cells: Plan["tasteCells"] = [];
  const stepLon = 0.003;
  const stepLat = 0.00205;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 16; col++) {
      const lat = EXAMPLE_CENTER.lat + (row - 5.5) * stepLat;
      const lon = EXAMPLE_CENTER.lon + (col - 7.5) * stepLon + (row % 2 ? stepLon / 2 : 0);
      let a = 0.06;
      for (const [hl, ho, k] of HEAT) {
        const d2 = ((lat - hl) / 0.0035) ** 2 + ((lon - ho) / 0.0045) ** 2;
        a = Math.max(a, k * Math.exp(-d2));
      }
      cells.push({ lat, lon, affinity: Math.min(1, a), geohash: null });
    }
  }
  return cells;
})();
