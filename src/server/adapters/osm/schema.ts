import { z } from "zod";

/** One Overpass element as `out tags center` returns it: a node carries lat/lon, a way or relation its centre. */
export const overpassElementSchema = z.object({
  type: z.enum(["node", "way", "relation"]),
  id: z.number(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

/**
 * Overpass API JSON (`[out:json]`): the fields we read. Elements are validated one by one (a bad row is dropped, not the
 * answer). A query that ran out of time or memory still answers HTTP 200, with a `remark` and whatever it had so far.
 */
export const overpassResponseSchema = z.object({
  elements: z.array(z.unknown()),
  remark: z.string().optional(),
});

export type OverpassElement = z.infer<typeof overpassElementSchema>;
export type OverpassResponse = z.infer<typeof overpassResponseSchema>;
