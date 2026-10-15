import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { geohashEncode, type LatLon } from "@/lib/geo";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { AdapterError, fetchJson } from "../core";
import { eventSchema, eventsResponseSchema, type CrowdEvent } from "./schema";

/**
 * Ticketmaster Discovery API. Searched by geoPoint and radius, because the
 * city filter leaks venues from other cities. Cache policy: 6 hours.
 */
const BASE = "https://app.ticketmaster.com/discovery/v2/events.json";
const TIMEOUT_MS = 6_000;
/** When an event has no end time, assume this long (labelled as an estimate). */
export const ASSUMED_EVENT_HOURS = 3;

/** Ticketmaster status codes for events that won't happen when listed. */
const NO_CROWD_STATUSES = new Set(["cancelled", "canceled", "postponed"]);

const tmTime = (date: Date) => `${date.toISOString().slice(0, 19)}Z`;

export function toCrowdEvent(raw: unknown): CrowdEvent | null {
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return null;
  const event = parsed.data;
  const venue = event._embedded?.venues?.[0];
  const start = event.dates.start.dateTime;
  if (!venue?.location || !start) return null;
  // A cancelled or postponed event draws no crowd. Ticketmaster flags it in the status, and often in the name too.
  const statusCode = event.dates.status?.code?.toLowerCase() ?? "";
  if (NO_CROWD_STATUSES.has(statusCode) || /^\s*(cancel+ed|postponed)\b/i.test(event.name)) return null;
  const endRaw = event.dates.end?.dateTime;
  const primary = event.classifications?.find((c) => c.primary) ?? event.classifications?.[0];
  const segment = primary?.segment?.name ?? null;
  return {
    id: event.id,
    name: event.name,
    url: event.url ?? null,
    venue: { id: venue.id, name: venue.name ?? "Venue", lat: venue.location.latitude, lon: venue.location.longitude },
    start,
    localTime: event.dates.start.localTime?.slice(0, 5) ?? null,
    end: endRaw ?? new Date(new Date(start).getTime() + ASSUMED_EVENT_HOURS * 3_600_000).toISOString(),
    endEstimated: !endRaw,
    segment,
    genre: primary?.genre?.name ?? null,
    artists: segment === "Music" ? (event._embedded?.attractions ?? []) : [],
    status: event.dates.status?.code ?? null,
  };
}

/** Events within `radiusKm` of `center` that start between the two instants. */
export async function fetchEvents(
  center: LatLon,
  radiusKm: number,
  startIso: string,
  endIso: string,
): Promise<CrowdEvent[]> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 21_600, expire: 86_400 });
  cacheTag("events");

  const apiKey = env().TICKETMASTER_API_KEY;
  if (!apiKey) throw new AdapterError("events", "missing_key", "Ticketmaster key is not configured");

  const params = new URLSearchParams({
    apikey: apiKey,
    geoPoint: geohashEncode(center, 9),
    radius: String(radiusKm),
    unit: "km",
    startDateTime: tmTime(new Date(startIso)),
    endDateTime: tmTime(new Date(endIso)),
    size: "100",
    sort: "date,asc",
  });
  const body = await fetchJson(`${BASE}?${params}`, { adapter: "events", schema: eventsResponseSchema, timeoutMs: TIMEOUT_MS });
  const raw = body._embedded?.events ?? [];
  const events = raw.map(toCrowdEvent).filter((e): e is CrowdEvent => e !== null);
  if (events.length < raw.length) {
    log.warn("ticketmaster events skipped", { skipped: raw.length - events.length, total: raw.length });
  }
  return events;
}
