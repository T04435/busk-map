import { describe, expect, it } from "vitest";
import { planRequestSchema } from "@/lib/plan-schema";
import { planKey } from "@/server/agent/plan-store";
import { snapshotFor, viewerRequest } from "@/server/plans";
import { canonicalJson, requestHash, storedRequestOf, type StoredPlan } from "@/server/plans/store";

/**
 * GOLDEN (plan-inputs-architecture.md §1.3). Requests stored before the plan-inputs change must parse to the SAME
 * object, so requestHash, planKey and the saved-run check stay byte-identical and /p/<id> keeps replaying its run.
 * The literal hashes below were computed on the code BEFORE the change (HEAD 3ea9812). If one fails, a new field
 * got a default or the fixed slot stopped parsing first: fix the schema, never the literals.
 */
const FIXTURES = {
  fullSaturday: {
    request: {
      city: "melbourne",
      slot: { date: "2026-10-16", startHour: 18, endHour: 21 },
      permit: "premium",
      performer: {
        name: "Jess & the Strays",
        artists: ["Paul Kelly", "Missy Higgins"],
        spotifyArtists: [{ name: "Paul Kelly", id: "0aBcDeFgHiJkLmNoPqRsTu" }],
        songs: [
          { title: "Dumb Things", artist: "Paul Kelly", own: false, durationMs: 215000 },
          { title: "Stray", artist: "Jess", own: true },
        ],
      },
      weights: { taste: 0.5, footfall: 0.2 },
    },
    exampleId: null,
    hash: "8e4a27e70d7d1ba33d903d5c1aee932633dc305f52716594db7f6e29623e58d6",
    key: "6b8f2a5d19f7197a42fc16b0a7d2fda1157b85f2",
  },
  minimalLegacy: {
    request: {
      city: "melbourne",
      slot: { date: "2026-10-01", startHour: 9, endHour: 12 },
      performer: { name: "Old link", artists: ["Archie Roach"] },
    },
    exampleId: "acoustic",
    hash: "3b2b641c12fb6ccf884f827a5ae3d57b9c6f0c0b0a912669551916b6b5c70ae9",
    key: "74d516af7d5e51b6d430935605d84b079a8f4d01",
  },
  legacyExtraKeys: {
    // An old row with a dropped `history` field and an `any` key beside real hours: hours given are hours meant.
    request: {
      city: "melbourne",
      slot: { date: "2026-10-03", startHour: 12, endHour: 15, any: true },
      permit: "circle-act",
      performer: { name: "Extra", artists: ["Courtney Barnett"], songs: [{ title: "Avant Gardener", artist: "Courtney Barnett", own: false }], history: [] },
      history: [{ title: "x" }],
    },
    exampleId: null,
    hash: "99ecb2f68e79fd645db99825aefd5984dda3f4592ad78fbcc6abad7086a62a28",
    key: "1e9fb46bd406a19c195b25c65926efc1a369f37e",
  },
} as const;

describe("golden: old stored requests hash identically", () => {
  for (const [name, f] of Object.entries(FIXTURES)) {
    it(`${name}: requestHash, planKey and the saved-run check are unchanged`, () => {
      const parsed = planRequestSchema.parse(f.request);
      // No new key appears on a parsed old request.
      expect(canonicalJson(parsed)).not.toMatch(/fillSuggested|skipSongs|"any"/);
      expect(requestHash(storedRequestOf(parsed), f.exampleId)).toBe(f.hash);
      expect(planKey(parsed, false, "2026-10-16")).toBe(f.key);

      // The saved run on /p/<id> is still found for it.
      const stored = {
        id: "abcd1234",
        request: f.request,
        exampleId: f.exampleId,
        day: "2026-10-16",
        snapshot: { plan: {}, events: [], explanations: "ai", runKey: f.key, runDay: "2026-10-16", startedAt: 1, finishedAt: 2 },
      } as unknown as StoredPlan;
      const viewer = viewerRequest(stored)!;
      expect(viewer).toEqual(parsed);
      expect(snapshotFor(stored, viewer, false)).not.toBeNull();
    });
  }
});

describe("new fields change the hash only when used", () => {
  it("an any-time or fill request is a different request", () => {
    const base = planRequestSchema.parse(FIXTURES.fullSaturday.request);
    const any = planRequestSchema.parse({ ...FIXTURES.fullSaturday.request, slot: { date: "2026-10-16", any: true } });
    const fill = planRequestSchema.parse({ ...FIXTURES.fullSaturday.request, performer: { ...FIXTURES.fullSaturday.request.performer, fillSuggested: 6 } });
    const hashes = [base, any, fill].map((r) => requestHash(storedRequestOf(r), null));
    expect(new Set(hashes).size).toBe(3);
    expect(planKey(base, false, "d")).not.toBe(planKey(any, false, "d"));
  });
});
