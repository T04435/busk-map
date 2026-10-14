import "server-only";
import { generateText, Output } from "ai";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { describeSlot } from "@/lib/slot";
import type { PlanRequest } from "@/lib/plan-schema";
import { CITIES } from "@/server/cities";
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
  spots: z.array(z.object({ name: z.string().max(120), why: z.string().max(300) })).max(3),
  setlist: z.array(z.string().max(120)).max(8),
});

export type PlainSpot = { name: string; why: string; usualSpot: string | null };

export type CompareResult =
  | { text: string; spots: PlainSpot[]; setlist: string[]; model: string }
  | { text: null; reason: "unavailable" | "error" };

/** Names a plain answer uses for Melbourne's well-known busking hotspots. */
const HOTSPOT_ALIASES: [RegExp, string][] = [
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

export function comparePrompt(request: Pick<PlanRequest, "city" | "slot" | "performer">): string {
  const songs = request.performer.songs.map((s) => s.title).slice(0, 12).join(", ");
  return [
    `I'm a street performer in ${CITIES[request.city].name}. My music sounds like ${request.performer.artists.join(", ")}.`,
    songs ? `Songs I can play: ${songs}.` : "",
    `Where should I busk on ${describeSlot(request.slot)}, and what setlist should I play? Give three spots with a one-sentence reason each, and a short setlist.`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function cachedCompare(prompt: string, offline: boolean): Promise<z.infer<typeof plainAnswerSchema>> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("compare");
  const { output } = await generateText({
    model: offline ? createMockCompare() : MODELS.cheap,
    output: Output.object({ schema: plainAnswerSchema }),
    prompt,
    maxOutputTokens: LIMITS.compareMaxOutputTokens,
    abortSignal: AbortSignal.timeout(LIMITS.compareTimeoutMs),
  });
  return output;
}

export async function plainLlmSuggestion(request: Pick<PlanRequest, "city" | "slot" | "performer">, offline: boolean): Promise<CompareResult> {
  if (!offline && !providerStatus().aiGateway) return { text: null, reason: "unavailable" };
  try {
    const answer = await cachedCompare(comparePrompt(request), offline);
    const spots = answer.spots.map((s) => ({ ...s, usualSpot: usualSpotMentioned(`${s.name} ${s.why}`) }));
    const text = [...spots.map((s, i) => `${i + 1}. ${s.name}: ${s.why}`), answer.setlist.length ? `Setlist: ${answer.setlist.join(", ")}` : ""].filter(Boolean).join("\n");
    return { text, spots, setlist: answer.setlist, model: offline ? "mock" : MODELS.cheap };
  } catch (error) {
    log.error("plain LLM comparison failed", { error: error instanceof Error ? error.message : "unknown" });
    return { text: null, reason: "error" };
  }
}
