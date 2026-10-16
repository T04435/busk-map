/**
 * Week planner state in the URL:
 *   /week?example=acoustic&start=2026-10-15&max=5&perDay=1&off=2026-10-17@19|2026-10-18@10
 * plus the same performer params as /plan (name, artists, songs, permit, w).
 * `off` lists unavailable slots by date and start hour (3-hour slots).
 */
import { findExample } from "./examples";
import { artistsParam, parseArtistsParam, parseSongsParam, songsParam } from "./performer-url";
import { parseWeightsParam, weightsParam } from "./weights-url";
import { weekRequestSchema, type WeekRequest } from "./week-schema";

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const list = (value: string | undefined) => (value ? value.split("|").map((s) => s.trim()).filter(Boolean) : []);

/** Length of a week-planner slot, in hours. */
export const WEEK_SLOT_HOURS = 3;

export type ParsedWeekUrl = { ok: true; request: WeekRequest; exampleId: string | null } | { ok: false; error: string };

export function parseWeekParams(params: Params, today: string): ParsedWeekUrl {
  const example = findExample(first(params.example));
  const name = first(params.name);
  const performer = name
    ? {
        name,
        ...parseArtistsParam(first(params.artists)),
        songs: parseSongsParam(first(params.songs)),
      }
    : example?.performer;
  if (!performer) return { ok: false, error: "Pick an example performer or describe your own." };

  const unavailable = list(first(params.off)).flatMap((entry) => {
    const [date, hour] = entry.split("@");
    const startHour = Number(hour);
    return Number.isInteger(startHour) ? [{ date, startHour, endHour: Math.min(24, startHour + WEEK_SLOT_HOURS) }] : [];
  });
  const parsed = weekRequestSchema.safeParse({
    city: first(params.city) ?? "melbourne",
    permit: first(params.permit) ?? "general",
    performer,
    startDate: first(params.start) ?? today,
    limits: {
      maxSessions: first(params.max) ? Number(first(params.max)) : undefined,
      maxPerDay: first(params.perDay) ? Number(first(params.perDay)) : undefined,
      unavailable,
    },
    weights: parseWeightsParam(first(params.w)),
  });
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    return { ok: false, error: `Some week details are missing or invalid: ${fields.join(", ")}.` };
  }
  return { ok: true, request: parsed.data, exampleId: name ? null : (example?.id ?? null) };
}

/** Serialise a week request (for links, toggles and the .ics export). */
export function weekSearchParams(request: WeekRequest, exampleId: string | null): URLSearchParams {
  const params = new URLSearchParams();
  if (exampleId) params.set("example", exampleId);
  else {
    params.set("name", request.performer.name);
    params.set("artists", artistsParam(request.performer));
    if (request.performer.songs.length) {
      params.set("songs", songsParam(request.performer.songs));
    }
  }
  params.set("permit", request.permit);
  params.set("start", request.startDate);
  params.set("max", String(request.limits.maxSessions));
  params.set("perDay", String(request.limits.maxPerDay));
  if (request.limits.unavailable.length) params.set("off", request.limits.unavailable.map((u) => `${u.date}@${u.startHour}`).join("|"));
  const w = weightsParam(request.weights);
  if (w) params.set("w", w);
  return params;
}
