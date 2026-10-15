/**
 * Scoring engine types. The engine is pure TypeScript: no I/O, no clock, no
 * randomness. Inputs are plain data shaped like the adapters' outputs.
 */
import type { LatLon } from "@/lib/geo";

export type PermitCategory =
  | "general"
  | "premium"
  | "circle-act"
  | "chess-board"
  | "pavement-art"
  | "private"
  | "no-busking"
  | "unknown";

/** The performer's busking permit. */
export type PerformerPermit = "general" | "premium" | "circle-act";

export type SiteInput = LatLon & {
  id: string;
  name: string;
  permit: PermitCategory;
  musicAllowed: boolean | null;
  rules: string;
  rulesUrl: string | null;
};

export type ZoneInput = { id: string; kind: "unamplified" | "no-busking"; lines: LatLon[][] };

export type SensorInput = LatLon & { id: number; name: string; avgHourly: number | null };

export type HeatCellInput = LatLon & {
  affinity: number;
  /** The cell's geohash: its length gives the heatmap's resolution. */
  geohash?: string | null;
  /** Qloo's popularity for the cell (0–1): the last-resort footfall proxy. */
  popularity?: number | null;
};

/** A walkable public spot (OpenStreetMap-derived), a candidate pitch location. */
export type SpotInput = LatLon & { id: string; name: string; kind: string };

/** A well-known busking hotspot: pitches near one are "usual spots". */
export type HotspotInput = LatLon & { name: string; /** Defaults to USUAL_SPOT_RADIUS_M; large sites such as a market need more. */ radiusM?: number };

export type PlaceInput = LatLon & {
  id: string;
  name: string;
  popularity: number | null;
  hours: Record<string, unknown> | null;
  /** Venue detail from Qloo, for the pitch's reasons (not scored). */
  liveMusic?: boolean | null;
  goodFor?: string[];
  keywords?: string[];
};

export type EventInput = {
  id: string;
  name: string;
  url?: string | null;
  venue: LatLon & { name: string };
  /** UTC ISO. */
  start: string;
  /** UTC ISO. */
  end: string;
  endEstimated: boolean;
  /**
   * How close the event crowd's taste is to the performer's: Qloo affinity of
   * the event's headliner given the performer's artists (0–1), when known.
   */
  tasteMatch?: { artist: string; affinity: number } | null;
};

export type WeatherHourInput = {
  precipitationProbability: number | null;
  windKmh: number | null;
  temperatureC: number | null;
};

export type Candidate = LatLon & {
  id: string;
  name: string;
  /**
   * A council-designated site, a public space (square, laneway, promenade…)
   * or a footpath at a pedestrian sensor, both under the general permit.
   */
  kind: "designated" | "public-space" | "footpath";
  /** Why it is a candidate: a top Qloo taste cell, a council site, or the no-taste fallback. */
  origin: "taste" | "council" | "fallback";
  /** The taste cell it was snapped from (origin "taste"). */
  cell: { lat: number; lon: number; affinity: number; rank: number } | null;
  /** The well-known hotspot it sits at, or null when it is off the usual circuit. */
  usualSpot: string | null;
  amplification: "allowed" | "unamplified-zone";
  permit: PermitCategory;
  rules: string;
  rulesUrl: string | null;
  /** Things the performer must check on the day. */
  cautions: string[];
};

export type FactorName = "taste" | "footfall" | "places" | "events";

export type Weights = Record<FactorName | "weather" | "discovery", number>;

export type Factors = Record<FactorName, number | null> & {
  weatherPenalty: number | null;
  /** Hidden-gem bonus, 0–1: the taste fit of a strong pitch off the usual circuit, else 0. */
  discovery: number;
};

export type FootfallSource = "sensor" | "nearby-sensors" | "qloo-popularity";

export type Discovery = "hidden-gem" | "usual" | null;
