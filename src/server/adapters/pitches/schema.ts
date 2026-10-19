import { z } from "zod";
import type { LatLon } from "@/lib/geo";

/** ArcGIS feature collection item (BuskingPoints) and FeatureServer GeoJSON. */

const flag = z.string().nullable().optional();

export const buskingPointsSchema = z.object({
  layers: z
    .array(
      z.object({
        featureSet: z.object({
          features: z.array(
            z.object({
              geometry: z.object({ x: z.number(), y: z.number() }),
              attributes: z.object({
                FID: z.number().int(),
                Location: z.string().nullable(),
                Permit_Typ: z.string().nullable(),
                Descriptio: z.string().nullable(),
                Busking_Al: flag,
                Music_Allo: flag,
                Circle_Act: flag,
              }),
            }),
          ),
        }),
      }),
    )
    .min(1),
});

const position = z.tuple([z.number(), z.number()]).rest(z.number());

export const zoneGeoJsonSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      properties: z.object({ FID: z.number().int() }).loose(),
      geometry: z.discriminatedUnion("type", [
        z.object({ type: z.literal("LineString"), coordinates: z.array(position) }),
        z.object({ type: z.literal("MultiLineString"), coordinates: z.array(z.array(position)) }),
      ]),
    }),
  ),
});

export type PermitCategory =
  | "general"
  | "premium"
  | "circle-act"
  | "chess-board"
  | "pavement-art"
  | "private"
  | "no-busking"
  | "unknown";

/** A site from the City of Melbourne busking map. Most are restrictions, not pitches. */
export type BuskingSite = LatLon & {
  id: string;
  name: string;
  permit: PermitCategory;
  buskingAllowed: boolean | null;
  musicAllowed: boolean | null;
  circleActs: boolean | null;
  /** The council's description, as plain text. */
  rules: string;
  /** A contact or rules link from the description, when there is one. */
  rulesUrl: string | null;
};

export type BuskingZone = {
  id: string;
  kind: "unamplified" | "no-busking";
  lines: LatLon[][];
};

export type PitchData = {
  sites: BuskingSite[];
  zones: BuskingZone[];
};
