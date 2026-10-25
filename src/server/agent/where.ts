import "server-only";
import { z } from "zod";
import { distanceM, inBBox, type BBox, type LatLon } from "@/lib/geo";
import { hotspotsFor, MELBOURNE, pitchesFor, type City } from "@/server/cities";
import { locate, type KnownPlace, type ScoredPitch } from "@/server/scoring";
import { HOTSPOT_ALIASES } from "./compare";

/**
 * Where the agent wants to look: a pitch id from score_pitches, a place name
 * Busk Map knows, or coordinates inside the city's planning area. Every
 * location-based tool takes this, and nothing outside the area is accepted.
 */
export const whereSchema = z
  .object({
    pitchId: z.string().max(80).optional().describe("A pitchId returned by score_pitches or check_pitch."),
    place: z.string().max(120).optional().describe("A place name, e.g. 'Federation Square' or 'Degraves Street'."),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
  })
  .describe("Give one of: pitchId, place, or lat and lon (inside the planning area).");

export type Where = z.infer<typeof whereSchema>;

export type Resolved = LatLon & { label: string; via: "pitch" | "place" | "coordinates"; pitchId: string | null };

/** Places Busk Map knows by name in a city: hotspots (with common names), public spots, council sites. */
export function knownPlaces(sites: { name: string; lat: number; lon: number }[], city: Pick<City, "id"> = MELBOURNE): KnownPlace[] {
  const aliases = (name: string) => HOTSPOT_ALIASES.filter(([, target]) => target === name).map(([pattern]) => pattern);
  return [
    ...hotspotsFor(city).map((h) => ({ name: h.name, lat: h.lat, lon: h.lon, aliases: aliases(h.name) })),
    ...pitchesFor(city).map((s) => ({ name: s.name, lat: s.lat, lon: s.lon })),
    ...sites.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon })),
  ];
}

export class WhereError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhereError";
  }
}

/** Round a point for Qloo calls (about 100 m), so nearby looks share the cache. */
export const snapPoint = ({ lat, lon }: LatLon): LatLon => ({ lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 });

/** Radii the agent may choose from, snapped up, so calls stay bounded and cacheable. */
export const RADII_M = [200, 400, 800, 1500] as const;
export const snapRadius = (radiusM: number | undefined, fallback: number) => RADII_M.find((r) => r >= (radiusM ?? fallback)) ?? RADII_M[RADII_M.length - 1];

/** A box of radiusM around a point, clipped to the planning area. */
export function boxAround(point: LatLon, radiusM: number, area: BBox): BBox {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((point.lat * Math.PI) / 180));
  return {
    south: Math.max(area.south, point.lat - dLat),
    north: Math.min(area.north, point.lat + dLat),
    west: Math.max(area.west, point.lon - dLon),
    east: Math.min(area.east, point.lon + dLon),
  };
}

export function resolveWhere(where: Where, opts: { area: BBox; pitches: ScoredPitch[]; places: KnownPlace[] }): Resolved {
  if (where.pitchId) {
    const pitch = opts.pitches.find((p) => p.id === where.pitchId);
    if (!pitch) throw new WhereError(`Unknown pitchId "${where.pitchId}". Use an id returned by score_pitches or check_pitch.`);
    return { lat: pitch.lat, lon: pitch.lon, label: pitch.name, via: "pitch", pitchId: pitch.id };
  }
  if (where.place) {
    const byPitchName = opts.pitches.find((p) => p.name.toLowerCase() === where.place!.trim().toLowerCase());
    if (byPitchName) return { lat: byPitchName.lat, lon: byPitchName.lon, label: byPitchName.name, via: "pitch", pitchId: byPitchName.id };
    const found = locate({ name: where.place, why: "" }, opts.places, opts.area);
    if (!found) throw new WhereError(`Busk Map doesn't know a place called "${where.place}" in the planning area. Try a nearby square or street, or coordinates from a tool result.`);
    if (!inBBox(found, opts.area)) throw new WhereError(`"${where.place}" is outside the planning area.`);
    return { lat: found.lat, lon: found.lon, label: found.place ?? where.place, via: "place", pitchId: null };
  }
  if (typeof where.lat === "number" && typeof where.lon === "number") {
    const point = { lat: where.lat, lon: where.lon };
    if (!inBBox(point, opts.area)) {
      const { south, west, north, east } = opts.area;
      throw new WhereError(`(${where.lat}, ${where.lon}) is outside the planning area (lat ${south} to ${north}, lon ${west} to ${east}).`);
    }
    const nearest = opts.places
      .map((p) => ({ p, d: distanceM(p, point) }))
      .sort((a, b) => a.d - b.d)[0];
    const label = nearest && nearest.d <= 150 ? `near ${nearest.p.name}` : `${where.lat.toFixed(4)}, ${where.lon.toFixed(4)}`;
    return { ...point, label, via: "coordinates", pitchId: null };
  }
  throw new WhereError("Give a pitchId, a place name, or lat and lon.");
}

/** The nearest known place to a point, for labelling results. */
export function nearestName(point: LatLon, places: KnownPlace[], maxM = 250): string | null {
  let best: { name: string; d: number } | null = null;
  for (const p of places) {
    const d = distanceM(p, point);
    if (d <= maxM && (!best || d < best.d)) best = { name: p.name, d };
  }
  return best?.name ?? null;
}
