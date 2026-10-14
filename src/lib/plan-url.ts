/**
 * Plan state lives in the URL, so a plan can be shared by link:
 *   /plan?example=acoustic
 *   /plan?name=…&artists=A|B&songs=Title~Artist|Own Song~Me~own&date=2026-10-17&from=18&to=21&permit=general
 * Optional: w=taste,footfall,places,events,weather[,discovery]  pitch=<id>  run=1 (start the agent)
 */
import { findExample } from "./examples";
import { parseWeightsParam, weightsParam } from "./weights-url";
import { planRequestSchema, type PlanRequest } from "./plan-schema";
import { nextWeekday } from "./slot";

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const list = (value: string | undefined) => (value ? value.split("|").map((s) => s.trim()).filter(Boolean) : []);

export type ParsedPlanUrl =
  | { ok: true; request: PlanRequest; exampleId: string | null; pitchId: string | null; autoRun: boolean }
  | { ok: false; error: string };

export function parsePlanParams(params: Params, today: string): ParsedPlanUrl {
  const example = findExample(first(params.example));
  const name = first(params.name);
  const performer = name
    ? {
        name,
        artists: list(first(params.artists)),
        songs: list(first(params.songs)).map((entry) => {
          const [title, artist, flag] = entry.split("~");
          return { title, artist, own: flag === "own" };
        }),
      }
    : example?.performer;
  if (!performer) return { ok: false, error: "Pick an example performer or describe your own." };

  const date = first(params.date) ?? (example ? nextWeekday(example.weekday, today) : nextWeekday("saturday", today));
  const startHour = Number(first(params.from) ?? example?.startHour ?? 18);
  const endHour = Number(first(params.to) ?? example?.endHour ?? 21);

  const parsed = planRequestSchema.safeParse({
    city: first(params.city) ?? "melbourne",
    slot: { date, startHour, endHour },
    permit: first(params.permit) ?? "general",
    performer,
    weights: parseWeightsParam(first(params.w)),
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
    autoRun: first(params.run) === "1",
  };
}

/** Build /plan search params for a custom performer. */
export function planSearchParams(request: PlanRequest, extra: Record<string, string> = {}): URLSearchParams {
  const params = new URLSearchParams({
    name: request.performer.name,
    artists: request.performer.artists.join("|"),
    date: request.slot.date,
    from: String(request.slot.startHour),
    to: String(request.slot.endHour),
    permit: request.permit,
  });
  if (request.performer.songs.length) {
    params.set("songs", request.performer.songs.map((s) => [s.title, s.artist, s.own ? "own" : ""].filter(Boolean).join("~")).join("|"));
  }
  const w = weightsParam(request.weights);
  if (w) params.set("w", w);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return params;
}
