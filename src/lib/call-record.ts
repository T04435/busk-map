import { z } from "zod";

/**
 * One external call a research step made (client-safe): the provider, the endpoint, the parameters sent (keys and tokens
 * stripped), the HTTP status (null when no request was sent: a cache hit, or the offline fixtures), how many results came
 * back, how long it took, and whether the data cache answered it. Stored with the run on the step's `tool-end`.
 */
export const callRecordSchema = z.object({
  provider: z.string(),
  endpoint: z.string(),
  params: z.record(z.string(), z.string()),
  status: z.number().int().nullable(),
  count: z.number().int().nullable(),
  ms: z.number().int().min(0),
  cached: z.boolean(),
});
export type CallRecord = z.infer<typeof callRecordSchema>;

/** The most calls kept per step (a long Spotify catalogue walk is cut here). */
export const MAX_CALLS_PER_STEP = 40;
