import "server-only";
import { generateText, Output } from "ai";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { describeSlot, isAnyTime, weekdayOf } from "@/lib/slot";
import type { PlanRequest } from "@/lib/plan-schema";
import { cityOf, isMelbourne } from "@/server/cities";
import { providerStatus } from "@/server/env";
import { log } from "@/server/log";
import { createMockCompare } from "./mock-model";
import { LIMITS, MODELS } from "./models";

/**
 * "What a plain LLM would suggest": one cheap model call, no tools, no data.
 * Shown next to the plan, clearly labelled. The answer is structured (three
 * spots and a setlist) so the UI can set it beside Busk Map's data-led
 * pitches, and each spot is checked against the well-known busking hotspots.
 * Cached per performer and slot.
 */
export const plainAnswerSchema = z.object({
  spots: z
    .array(
      z.object({
        name: z.string().max(160).describe("A real, nameable place: a square, street corner, laneway or forecourt."),
        lat: z.number().nullable().describe("Approximate latitude, or null if unsure."),
        lon: z.number().nullable().describe("Approximate longitude, or null if unsure."),
        why: z.string().max(1200).describe("One short reason, under 25 words."),
      }),
    )
    .max(3),
  setlist: z.array(z.string().max(160)).max(10),
});

export type PlainSpot = { name: string; why: string; usualSpot: string | null; lat: number | null; lon: number | null };

export type CompareResult =
  | { text: string; spots: PlainSpot[]; setlist: string[]; model: string }
  | { text: null; reason: "unavailable" | "error" };

/** Names a plain answer uses for Melbourne's well-known busking hotspots. */
export const HOTSPOT_ALIASES: [RegExp, string][] = [
  [/bourke\s+st(reet)?(\s+mall)?/i, "Bourke Street Mall"],
  [/fed(eration)?\s+sq(uare)?/i, "Federation Square"],
  [/flinders\s+st(reet)?\s+station|flinders\s+st(reet)?\s+(steps|corner)|under the clocks/i, "Flinders Street Station"],
  [/southbank|southgate/i, "Southbank Promenade at Southgate"],
  [/state\s+library/i, "State Library Victoria"],
  [/queen\s+vic(toria)?\s+market|\bqvm\b/i, "Queen Victoria Market"],
  [/melbourne\s+central|swanston\s+st(reet)?/i, "Melbourne Central (Swanston St)"],
];

export function usualSpotMentioned(text: string): string | null {
  return HOTSPOT_ALIASES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

const capitalise = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

/**
 * The baseline question. It is the control for Busk Map, so it must be a fair
 * one: the same performer, songs, city, day and slot, and an honest ask for
 * the best answer a knowledgeable local could give without data.
 */
export function comparePrompt(request: Pick<PlanRequest, "city" | "place" | "slot" | "performer">): string {
  const songs = request.performer.songs.map((s) => `${s.title} (${s.artist})`).slice(0, 12).join("; ");
  const city = cityOf(request).name;
  return [
    `You are an experienced street performer who knows ${city} well. Give a fellow busker your honest best advice.`,
    `The act: ${request.performer.name}. Their music sounds like ${request.performer.artists.join(", ")}.`,
    songs ? `Songs they can play: ${songs}.` : "They haven't listed songs.",
    isAnyTime(request.slot)
      ? `When: ${capitalise(weekdayOf(request.slot.date))} ${request.slot.date}, at whatever time of day is best, in central ${city}.`
      : `When: ${describeSlot(request.slot)}, in central ${city}.`,
    "Recommend the three best spots to busk for this act at this time: real, specific places (a square, street corner, laneway or forecourt) where busking is allowed and the people passing then would enjoy this music.",
    "For each, give its name, its approximate latitude and longitude (null if you aren't sure) and one short reason (under 25 words).",
    "Then a setlist of up to six songs, from their list where possible, in the order to play them.",
  ].join(" ");
}

async function cachedCompare(prompt: string, offline: boolean): Promise<z.infer<typeof plainAnswerSchema>> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("compare");
  const ask = () =>
    generateText({
      model: offline ? createMockCompare() : MODELS.cheap,
      output: Output.object({ schema: plainAnswerSchema }),
      prompt,
      maxOutputTokens: LIMITS.compareMaxOutputTokens,
      abortSignal: AbortSignal.timeout(LIMITS.compareTimeoutMs),
    });
  // A small model sometimes breaks the JSON: one retry, then give up.
  const { output } = await ask().catch(() => ask());
  return output;
}

export async function plainLlmSuggestion(request: Pick<PlanRequest, "city" | "place" | "slot" | "performer">, offline: boolean): Promise<CompareResult> {
  if (!offline && !providerStatus().aiGateway) return { text: null, reason: "unavailable" };
  try {
    const answer = await cachedCompare(comparePrompt(request), offline);
    const spots = answer.spots.map((s) => ({ name: s.name, why: s.why.length > 300 ? `${s.why.slice(0, 297)}…` : s.why, lat: s.lat ?? null, lon: s.lon ?? null, usualSpot: isMelbourne(cityOf(request)) ? usualSpotMentioned(`${s.name} ${s.why}`) : null }));
    const text = [...spots.map((s, i) => `${i + 1}. ${s.name}: ${s.why}`), answer.setlist.length ? `Setlist: ${answer.setlist.join(", ")}` : ""].filter(Boolean).join("\n");
    return { text, spots, setlist: answer.setlist, model: offline ? "mock" : MODELS.cheap };
  } catch (error) {
    log.error("plain LLM comparison failed", { error: error instanceof Error ? error.message : "unknown" });
    return { text: null, reason: "error" };
  }
}
