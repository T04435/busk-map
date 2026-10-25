import { z } from "zod";

/** Open-Meteo /v1/search (geocoding) response: the fields we read. No match is a response without `results`. */
export const geocodeResultSchema = z.object({
  id: z.number(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  /** GeoNames feature code: PPL… for populated places. */
  feature_code: z.string().optional(),
  country_code: z.string().optional(),
  country: z.string().optional(),
  admin1: z.string().optional(),
  timezone: z.string().optional(),
  population: z.number().optional(),
});

export const geocodeResponseSchema = z.object({
  results: z.array(z.unknown()).optional(),
});

export type GeocodeResult = z.infer<typeof geocodeResultSchema>;
