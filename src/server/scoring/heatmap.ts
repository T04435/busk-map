/** Radii for reading Qloo's heatmap near a point (taste and popularity share them). */

/** Cells within this distance inform a pitch's taste (geohash-6 cells are about 600 × 1,000 m). */
export const TASTE_RADIUS_M = 900;
/**
 * Live Qloo heatmaps over the city centre come back at geohash precision 7
 * (cells about 150 m across), so taste is read over a tighter radius: street
 * level rather than neighbourhood level.
 */
export const FINE_TASTE_RADIUS_M = 300;
/** Geohash length from which a heatmap counts as fine-grained. */
export const FINE_GEOHASH_PRECISION = 7;

/** True when the heatmap's cells are fine-grained (geohash precision 7 or more). */
export function isFineHeatmap(cells: { geohash?: string | null }[]): boolean {
  const lengths = cells.flatMap((c) => (c.geohash ? [c.geohash.length] : [])).sort((a, b) => a - b);
  return lengths.length > 0 && lengths[Math.floor(lengths.length / 2)] >= FINE_GEOHASH_PRECISION;
}
