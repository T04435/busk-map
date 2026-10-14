import "server-only";
import { generateText } from "ai";
import { cacheLife, cacheTag } from "next/cache";
import { describeSlot } from "@/lib/slot";
import type { PlanRequest } from "@/lib/plan-schema";
import { providerStatus } from "@/server/env";
import { log } from "@/server/log";
import { CITIES } from "@/server/cities";
import { createMockCompare } from "./mock-model";
import { LIMITS, MODELS } from "./models";

/**
 * "What a plain LLM would suggest": one cheap model call, no tools, no data.
 * Shown next to the plan, clearly labelled. Cached per performer and slot.
 */
export type CompareResult = { text: string; model: string } | { text: null; reason: "unavailable" | "error" };

export function comparePrompt(request: Pick<PlanRequest, "city" | "slot" | "performer">): string {
  const songs = request.performer.songs.map((s) => s.title).slice(0, 12).join(", ");
  return [
    `I'm a street performer in ${CITIES[request.city].name}. My music sounds like ${request.performer.artists.join(", ")}.`,
    songs ? `Songs I can play: ${songs}.` : "",
    `Where should I busk on ${describeSlot(request.slot)}, and what setlist should I play? Give three spots and a short setlist.`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function cachedCompare(prompt: string, offline: boolean): Promise<string> {
  "use cache: remote";
  cacheLife("days");
  cacheTag("compare");
  const { text } = await generateText({
    model: offline ? createMockCompare() : MODELS.cheap,
    prompt,
    maxOutputTokens: LIMITS.compareMaxOutputTokens,
    abortSignal: AbortSignal.timeout(LIMITS.compareTimeoutMs),
  });
  return text;
}

export async function plainLlmSuggestion(
  request: Pick<PlanRequest, "city" | "slot" | "performer">,
  offline: boolean,
): Promise<CompareResult> {
  if (!offline && !providerStatus().aiGateway) return { text: null, reason: "unavailable" };
  try {
    return { text: await cachedCompare(comparePrompt(request), offline), model: offline ? "mock" : MODELS.cheap };
  } catch (error) {
    log.error("plain LLM comparison failed", { error: error instanceof Error ? error.message : "unknown" });
    return { text: null, reason: "error" };
  }
}
