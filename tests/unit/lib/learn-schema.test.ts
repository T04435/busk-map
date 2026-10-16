import { describe, expect, it } from "vitest";
import { becauseText, learnStreamEventSchema, patchSuggestionSchema, ZERO_LEARN_TOTALS } from "@/lib/learn-schema";
import { LEARN_TOOL_LABELS, toolLabel } from "@/lib/learn-tools";
import { planStreamEventSchema } from "@/lib/plan-schema";

const inputs = { songs: 9, soundsLike: ["Paul Kelly"], pitches: ["Bourke Street Mall"] };

describe("learn stream events (docs §7.2)", () => {
  const events = [
    { type: "run", runId: "r", number: 3, startedAt: "2026-10-17T00:00:00.000Z", model: "claude", inputs, replay: false, stepsKept: true },
    { type: "status", message: "Run started" },
    { type: "status", message: "Replaying", replay: true },
    { type: "note", kind: "reasoning", text: "Thinking" },
    { type: "tool-start", id: "1", tool: "related_artists", label: "Artists your fans also like", source: "Qloo", input: { take: 10 } },
    { type: "tool-end", id: "1", tool: "related_artists", ok: true, summary: "Found 14 artists your fans also like", output: { artists: [] } },
    { type: "totals", totals: ZERO_LEARN_TOTALS },
    { type: "suggestion", runId: "r", id: "7", rank: 1, title: "T", artist: "A", year: 1998, durationMs: 210000, image: "https://i.scdn.co/image/x", songSource: "spotify", sourceUrl: "https://open.spotify.com/track/x", reason: "Because", because: "Fans of A like them", basedOn: [{ kind: "learned", name: "Song" }, { kind: "repertoire", name: "X" }, { kind: "crowd", name: "Pitch" }, { kind: "soundsLike", name: "Y" }], growth: null, trendDelta: 1.5, isNew: true, status: "pending" },
    { type: "suggestion", runId: "r", id: "8", rank: 2, title: "T", artist: "A", year: null, durationMs: null, image: null, songSource: "lastfm", sourceUrl: null, reason: "R", because: null, basedOn: [], growth: null, trendDelta: null, isNew: false, status: "dismissed" },
    { type: "usage", steps: 5, inputTokens: 10, outputTokens: 5, reasoningTokens: 0, ms: 1000, stoppedBy: "finished" },
    { type: "end", ok: true, runId: "r", mode: "agent", newCount: 6, skippedCount: 7, code: null, message: "Done" },
    { type: "end", ok: false, runId: "r", mode: "none", newCount: 0, skippedCount: 0, code: "qloo_unavailable", message: "Down" },
  ];

  it("parses every event in the contract", () => {
    for (const e of events) expect(learnStreamEventSchema.safeParse(e).success, JSON.stringify(e).slice(0, 80)).toBe(true);
  });

  it("has no plan and no error event; the end codes are the contract's", () => {
    expect(learnStreamEventSchema.safeParse({ type: "plan", plan: {} }).success).toBe(false);
    expect(learnStreamEventSchema.safeParse({ type: "error", code: "x", message: "y" }).success).toBe(false);
    for (const code of ["timeout", "stopped", "model_unavailable", "qloo_unavailable", "no_match", "nothing_new", null]) {
      expect(learnStreamEventSchema.safeParse({ type: "end", ok: true, runId: "r", mode: "fallback", newCount: 0, skippedCount: 0, code, message: "m" }).success).toBe(true);
    }
    for (const code of ["limit", "empty_playlist"]) expect(learnStreamEventSchema.safeParse({ type: "end", ok: false, runId: "r", mode: "none", newCount: 0, skippedCount: 0, code, message: "m" }).success).toBe(false);
  });

  it("totals are non-negative integers with exactly the contract's fields", () => {
    expect(Object.keys(ZERO_LEARN_TOTALS).sort()).toEqual(["alreadyKnown", "alreadySuggested", "artists", "crowds", "dismissedSkipped", "liked", "newSongs", "qlooCacheHits", "qlooCalls", "songsChecked"]);
    expect(learnStreamEventSchema.safeParse({ type: "totals", totals: { ...ZERO_LEARN_TOTALS, liked: -1 } }).success).toBe(false);
    expect(learnStreamEventSchema.safeParse({ type: "totals", totals: { ...ZERO_LEARN_TOTALS, liked: 1.5 } }).success).toBe(false);
  });

  it("shares status, note, tool-start, tool-end and usage with the plan stream, field for field; the plan stream itself is unchanged", () => {
    for (const e of events.filter((e) => ["status", "note", "tool-start", "tool-end", "usage"].includes(e.type))) {
      expect(planStreamEventSchema.safeParse(e).success, e.type).toBe(true);
    }
    // plan-only events still parse as before; learn-only ones don't parse as plan events
    expect(planStreamEventSchema.safeParse({ type: "error", code: "x", message: "y" }).success).toBe(true);
    expect(planStreamEventSchema.safeParse(events[0]).success).toBe(false);
    expect(planStreamEventSchema.safeParse(events.find((e) => e.type === "end")).success).toBe(false);
  });

  it("the status patch accepts only the three statuses", () => {
    for (const status of ["pending", "learned", "dismissed"]) expect(patchSuggestionSchema.safeParse({ status }).success).toBe(true);
    expect(patchSuggestionSchema.safeParse({ status: "deleted" }).success).toBe(false);
  });

  it("because reads as plain words", () => {
    expect(becauseText([])).toBeNull();
    expect(becauseText(["Dolly Parton"])).toBe("Fans of Dolly Parton like them");
    expect(becauseText(["Dolly Parton", "Gillian Welch", "Third"])).toBe("Fans of Dolly Parton and Gillian Welch like them");
  });

  it("labels are looked up by stream kind and tool: crowd_at is in both agents with different labels", () => {
    expect(toolLabel("learn", "crowd_at", "Who the crowd is around a point")).toBe("Who the crowd likes at your pitch");
    expect(toolLabel("plan", "crowd_at", "Who the crowd is around a point")).toBe("Who the crowd is around a point");
    expect(Object.keys(LEARN_TOOL_LABELS)).toEqual(["match_playlist", "history", "crowd_at", "related_artists", "rising", "crowd_profile", "top_tracks", "finish_suggestions"]);
  });
});
