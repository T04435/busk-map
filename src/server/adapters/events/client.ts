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
const TIMEOUT_MS = 10_000;
/** Ticketmaster pages hold up to 200 events; a week within 3 km of the CBD is usually under 100. */
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
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

/**
 * Every event within `radiusKm` of `center` starting from `dayIso` (the start of a UTC day) for
 * `days` days. One cached call per city per day serves every slot and week plan: Ticketmaster
 * allows about 5 requests a second, and a request per slot got throttled into timeouts.
 */
export async function fetchCityEvents(center: LatLon, radiusKm: number, dayIso: string, days: number): Promise<CrowdEvent[]> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 21_600, expire: 86_400 });
  cacheTag("events");

  const apiKey = env().TICKETMASTER_API_KEY;
  if (!apiKey) throw new AdapterError("events", "missing_key", "Ticketmaster key is not configured");

  const start = new Date(dayIso);
  const end = new Date(start.getTime() + days * 86_400_000);
  const events: CrowdEvent[] = [];
  let skipped = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      apikey: apiKey,
      geoPoint: geohashEncode(center, 9),
      radius: String(radiusKm),
      unit: "km",
      startDateTime: tmTime(start),
      endDateTime: tmTime(end),
      size: String(PAGE_SIZE),
      page: String(page),
      sort: "date,asc",
    });
    const body = await fetchWithRetry(`${BASE}?${params}`);
    const raw = body._embedded?.events ?? [];
    for (const item of raw) {
      const event = toCrowdEvent(item);
      if (event) events.push(event);
      else skipped++;
    }
    const totalPages = body.page?.totalPages ?? 1;
    if (page + 1 >= totalPages || raw.length < PAGE_SIZE) break;
  }
  if (skipped) log.warn("ticketmaster events skipped", { skipped, total: events.length + skipped });
  return events;
}

/** One retry after a timeout or a 5xx, half a second later. Ticketmaster is usually fast but occasionally stalls. */
async function fetchWithRetry(url: string) {
  const options = { adapter: "events" as const, schema: eventsResponseSchema, timeoutMs: TIMEOUT_MS };
  try {
    return await fetchJson(url, options);
  } catch (error) {
    const retryable = error instanceof AdapterError && (error.kind === "timeout" || (error.kind === "http" && (error.status ?? 0) >= 500));
    if (!retryable) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return fetchJson(url, options);
  }
}

