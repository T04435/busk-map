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

export type HeatCellInput = LatLon & { affinity: number };

export type PlaceInput = LatLon & {
  id: string;
  name: string;
  popularity: number | null;
  hours: Record<string, unknown> | null;
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
};

export type WeatherHourInput = {
  precipitationProbability: number | null;
  windKmh: number | null;
  temperatureC: number | null;
};

export type Candidate = LatLon & {
  id: string;
  name: string;
  /** A council-designated site, or a footpath under the general permit near a sensor. */
  kind: "designated" | "footpath";
  amplification: "allowed" | "unamplified-zone";
  permit: PermitCategory;
  rules: string;
  rulesUrl: string | null;
  /** Things the performer must check on the day. */
  cautions: string[];
};

export type FactorName = "taste" | "footfall" | "places" | "events";

export type Weights = Record<FactorName | "weather", number>;

export type Factors = Record<FactorName, number | null> & { weatherPenalty: number | null };
