import { z } from "zod";
import type { LatLon } from "@/lib/geo";

/** Ticketmaster Discovery API v2 /events.json (fields we use). */

const numeric = z.union([z.string(), z.number()]).transform((v) => Number(v)).pipe(z.number().finite());

const venueSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  location: z.object({ latitude: numeric, longitude: numeric }).optional(),
});

const classificationSchema = z.object({
  primary: z.boolean().optional(),
  segment: z.object({ name: z.string() }).optional(),
  genre: z.object({ name: z.string() }).optional(),
});

export const eventSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.url().optional(),
  dates: z.object({
    start: z.object({
      localDate: z.string().optional(),
      localTime: z.string().optional(),
      dateTime: z.string().optional(),
    }),
    end: z.object({ dateTime: z.string().optional() }).optional(),
    status: z.object({ code: z.string() }).optional(),
  }),
  classifications: z.array(classificationSchema).optional(),
  _embedded: z
    .object({
      venues: z.array(venueSchema).optional(),
      attractions: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    })
    .optional(),
});

export const eventsResponseSchema = z.object({
  _embedded: z.object({ events: z.array(z.unknown()) }).optional(),
  page: z.object({ totalElements: z.number() }).optional(),
});

export type CrowdEvent = {
  id: string;
  name: string;
  url: string | null;
  venue: LatLon & { id: string; name: string };
  /** UTC ISO start. */
  start: string;
  /** Local start time, "HH:MM". */
  localTime: string | null;
  /** UTC ISO end; estimated when Ticketmaster has none. */
  end: string;
  endEstimated: boolean;
  segment: string | null;
  genre: string | null;
  /** Performing artists, for Qloo affinity. Music only. */
  artists: { id: string; name: string }[];
  status: string | null;
};
