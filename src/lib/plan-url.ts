/**
 * Plan state lives in the URL, so a plan can be shared by link:
 *   /plan?example=acoustic
 *   /plan?name=…&artists=A|B~<spotify id>&songs=Title~Artist|Own Song~Me~own|Song~Artist~215s&date=2026-10-17&from=18&to=21&permit=general
 * Optional: own=<qlooId>~<name>[~<spotify id>] (the act's own artist on Qloo)
 * (artist ids and song lengths are optional; see lib/performer-url.ts)
 * Optional: wa=taste,activity,events,weather[,discovery]  (older links: w=taste,footfall,places,events,weather[,discovery])  pitch=<id>  run=0 (show the engine's plan only;
 * by default the agent starts on load, and the server replays a recent run of the same request)
 */
import { findExample } from "./examples";
import { artistsParam, fillParam, genresParam, ownParam, parseArtistsParam, parseFillParam, parseGenresParam, parseOwnParam, parseSongsParam, songsParam } from "./performer-url";
import { parseWeightsParam, weightsParam } from "./weights-url";
import { planRequestSchema, type PlanRequest } from "./plan-schema";
import { boundSongs, PLAN_SONGS_CONSIDERED } from "./plan-songs-bound";
import { isAnyTime, nextSlotDate } from "./slot";

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export type ParsedPlanUrl =
  | { ok: true; request: PlanRequest; exampleId: string | null; pitchId: string | null; autoRun: boolean }
  | { ok: false; error: string };

/** The city's current local date and hour. A default date is the next one whose slot hasn't ended by then. */
export type LocalNow = { today: string; hour: number };

export function parsePlanParams(params: Params, now: LocalNow): ParsedPlanUrl {
  const example = findExample(first(params.example));
  const name = first(params.name);
  const performer = name
    ? {
        name,
        ...parseArtistsParam(first(params.artists)),
        songs: parseSongsParam(first(params.songs)),
        ...parseFillParam(first(params.fill), first(params.skip)),
        ...parseOwnParam(first(params.own)),
        ...parseGenresParam(first(params.genres)),
      }
    : example?.performer;
  if (!performer) return { ok: false, error: "Pick an example performer or describe your own." };

  const startHour = Number(first(params.from) ?? example?.startHour ?? 18);
  const endHour = Number(first(params.to) ?? example?.endHour ?? 21);
  // An explicit date is kept as given. A default one is the next slot that hasn't ended (an evening click on Friday's
  // 5-8 pm example opens next Friday, not the slot that has just passed).
  const date = first(params.date) ?? nextSlotDate(example?.weekday ?? "saturday", startHour, endHour, now.today, now.hour);

  // time=any: any time on the date (from and to are ignored). Examples keep their fixed slots (D8).
  const anyTime = !example || name ? first(params.time) === "any" : false;
  const parsed = planRequestSchema.safeParse({
    city: first(params.city) ?? "melbourne",
    slot: anyTime ? { date, any: true } : { date, startHour, endHour },
    permit: first(params.permit) ?? "general",
    performer,
    weights: parseWeightsParam(first(params.wa), first(params.w)),
  });
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    return { ok: false, error: `Some plan details are missing or invalid: ${fields.join(", ")}.` };
  }
  return {
    ok: true,
    request: parsed.data,
    exampleId: name ? null : (example?.id ?? null),
    pitchId: first(params.pitch) ?? null,
    autoRun: first(params.run) !== "0",
  };
}

/** Build /plan search params for a custom performer. */
export function planSearchParams(request: PlanRequest, extra: Record<string, string> = {}): URLSearchParams {
  const params = new URLSearchParams({
    name: request.performer.name,
    artists: artistsParam(request.performer),
    date: request.slot.date,
    permit: request.permit,
  });
  if (isAnyTime(request.slot)) params.set("time", "any");
  else {
    params.set("from", String(request.slot.startHour));
    params.set("to", String(request.slot.endHour));
  }
  for (const [key, value] of fillParam(request.performer)) params.set(key, value);
  for (const [key, value] of ownParam(request.performer)) params.set(key, value);
  for (const [key, value] of genresParam(request.performer)) params.set(key, value);
  if (request.performer.songs.length) {
    // The engine only works on the bounded set (plan-songs-bound.ts), so the link carries just that: same plan, a URL that fits.
    params.set("songs", songsParam(boundSongs(request.performer.songs, PLAN_SONGS_CONSIDERED)));
  }
  const w = weightsParam(request.weights);
  if (w) params.set(w[0], w[1]);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return params;
}
