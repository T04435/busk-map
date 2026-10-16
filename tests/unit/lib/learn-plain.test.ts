import { describe, expect, it } from "vitest";
import { funnelOf, plainStep } from "@/lib/learn-plain";
import { LEARN_TOOL_LABELS } from "@/lib/learn-tools";

const step = (tool: string, output: unknown, over: Record<string, unknown> = {}) => ({ tool, status: "done" as const, summary: "", output, ...over });
const UUID = "urn:entity:3f2b8c1e-aaaa-4bbb-8ccc-123456789abc";

describe("plainStep: the learn tools' results in plain words (arch §7.1)", () => {
  it("match_playlist", () => {
    const out = { songs: 9, artists: [...Array(6)].map((_, i) => ({ name: `A${i}`, matched: true })).concat([{ name: "Nobody", matched: false }]), unmatched: ["Nobody"] };
    expect(plainStep(step("match_playlist", out))).toMatchObject({ headline: "Matched your 9 songs to 6 artists on Qloo", lines: ["Qloo couldn't match: Nobody"], problem: false });
    expect(plainStep(step("match_playlist", { songs: 1, artists: [{ name: "A", matched: true }], unmatched: [] })).headline).toBe("Matched your 1 song to 1 artist on Qloo");
  });

  it("history", () => {
    expect(plainStep(step("history", { earlierRuns: 3, learned: 2, pending: 5, dismissed: 4 })).headline).toBe("3 earlier runs: 2 learned, 5 to learn, 4 dismissed");
    expect(plainStep(step("history", { earlierRuns: 0 })).headline).toBe("No earlier runs: this is your first");
  });

  it("crowd_at reads the pitch, lists the top artists and shows the because chips", () => {
    const out = { pitch: "Bourke St Mall", artists: [{ artistId: UUID, name: "Dolly Parton", affinity: 0.9, because: ["Fans of Paul Kelly like them"] }, { artistId: UUID, name: "Gillian Welch", because: ["Fans of Paul Kelly like them", "Fans of Vance Joy like them"] }] };
    const plain = plainStep(step("crowd_at", out));
    expect(plain.headline).toBe("Read the crowd at Bourke St Mall");
    expect(plain.lines).toEqual(["Top artists: Dolly Parton, Gillian Welch"]);
    expect(plain.chips).toEqual(["Fans of Paul Kelly like them", "Fans of Vance Joy like them"]);
    expect(plainStep(step("crowd_at", { pitch: "city", artists: [{ name: "A" }] })).headline).toBe("Read the crowd at the city centre");
  });

  it("related_artists marks the ones already in the Repertoire", () => {
    const artists = [...Array(14)].map((_, i) => ({ artistId: `${UUID}-${i}`, name: `Artist ${i}`, alreadyInPlaylist: i === 0 }));
    const plain = plainStep(step("related_artists", { artists }));
    expect(plain.headline).toBe("Found 14 artists your fans also like");
    expect(plain.lines).toContain("Already in your Repertoire: Artist 0");
  });

  it("rising shows arrows, and says so when nothing moved or the data is stale", () => {
    const moving = plainStep(step("rising", { window: { start: "a", end: "b" }, artists: [{ name: "Up", trendDelta: 4.2 }, { name: "Down", trendDelta: -1 }, { name: "Flat", trendDelta: null }] }));
    expect(moving).toMatchObject({ headline: "Checked who's rising with those crowds", lines: ["Up ↑, Down ↓"] });
    expect(plainStep(step("rising", { window: { start: "a", end: "b" }, artists: [{ name: "Flat", trendDelta: null }] })).lines).toEqual(["No movement in Qloo's latest trending data"]);
    expect(plainStep(step("rising", { window: null, artists: [] })).headline).toBe("Qloo has no recent trending data for these artists");
  });

  it("crowd_profile, top_tracks and finish_suggestions", () => {
    expect(plainStep(step("crowd_profile", { ageLean: "25–34" })).headline).toBe("Your fans lean 25–34");
    const tt = "Picked top tracks on Spotify (Last.fm for 1) for 4 artists. Left out 5 songs suggested before and 2 you dismissed";
    expect(plainStep(step("top_tracks", { summary: tt })).headline).toBe(`${tt}.`);
    expect(plainStep(step("finish_suggestions", { accepted: true, summary: "Ranked 6 songs and wrote why" })).headline).toBe("Ranked 6 songs and wrote why");
    expect(plainStep(step("finish_suggestions", { accepted: false, problems: ["two songs by one artist"] }, { status: "failed" }))).toMatchObject({ headline: "Sent back: two songs by one artist (fixing)", problem: true });
  });

  it("never shows a tool name, a Qloo endpoint, an entity id or JSON, whatever the output holds", () => {
    const outputs: [string, unknown][] = [
      ["match_playlist", { songs: 3, artists: [{ name: "A", matched: true }], unmatched: [] }],
      ["history", { earlierRuns: 1, learned: 1, pending: 0, dismissed: 0 }],
      ["crowd_at", { pitch: "city", artists: [{ artistId: UUID, name: "A", because: ["Fans like them"] }] }],
      ["related_artists", { artists: [{ artistId: UUID, name: "A" }] }],
      ["rising", { window: { start: "a", end: "b" }, artists: [{ artistId: UUID, name: "A", trendDelta: 2 }] }],
      ["crowd_profile", { ageLean: "25–34", bands: { "18-24": 0.1 } }],
      ["top_tracks", { summary: "Picked top tracks on Spotify", songs: [{ songId: "s-1", artistId: UUID }] }],
      ["finish_suggestions", { accepted: true, summary: "Ranked 3 songs and wrote why", picks: [{ songId: "s-1" }] }],
    ];
    for (const [tool, output] of outputs) {
      const p = plainStep(step(tool, output));
      const all = [p.headline, ...p.lines, ...p.chips].join(" | ");
      expect(all, tool).not.toMatch(new RegExp(`[a-z]+_[a-z]+|/v2/|urn:|[{}\\[\\]]|[0-9a-f]{8}-[0-9a-f]{4}`));
    }
  });

  it("a running step shows its label, a failed one a short apology, a budget skip says why", () => {
    expect(plainStep({ tool: "match_playlist", status: "running" }).headline).toBe(LEARN_TOOL_LABELS.match_playlist);
    expect(plainStep(step("top_tracks", { error: `Unknown artistId ${UUID}` }, { status: "failed" }))).toMatchObject({ headline: "That look didn't work, so we moved on", problem: true });
    expect(plainStep(step("rising", { skipped: "budget" })).headline).toMatch(/requests are used up/);
  });
});

describe("funnelOf: one 'left out' count", () => {
  it("is alreadySuggested + dismissedSkipped + alreadyKnown, in the inventory's F04 order", () => {
    const f = funnelOf({ qlooCalls: 9, artists: 6, crowds: 3, liked: 14, songsChecked: 22, alreadySuggested: 4, dismissedSkipped: 2, alreadyKnown: 1, newSongs: 6 });
    expect(f.map((x) => `${x.value} ${x.label}`)).toEqual(["9 Qloo calls", "6 artists matched", "3 crowds read", "14 artists liked", "22 songs checked", "7 left out", "6 new songs"]);
    expect(funnelOf({ artists: 1, crowds: 1, liked: 1, songsChecked: 1, alreadySuggested: 0, dismissedSkipped: 0, alreadyKnown: 0, newSongs: 1 }).map((x) => x.label)).toEqual(["Qloo calls", "artist matched", "crowd read", "artist liked", "song checked", "left out", "new song"]);
  });
});

describe("the feed and the funnel agree", () => {
  it("one 'left out' count is the sum of what top_tracks left out, and the same number ends up in the end event", async () => {
    const { fromLearnOutputs } = await import("@/lib/learn-totals");
    const { skippedOf } = await import("@/lib/learn-schema");
    const summary = (s: { alreadySuggested: number; dismissed: number; canSing: number }) => `Picked top tracks on Spotify. Left out ${s.alreadySuggested} songs suggested before and ${s.dismissed} you dismissed`;
    const a = { alreadySuggested: 4, dismissed: 1, canSing: 2 };
    const b = { alreadySuggested: 1, dismissed: 0, canSing: 3 };
    const results = [
      { tool: "match_playlist", ok: true, output: { songs: 5, artists: [{ name: "A", matched: true }, { name: "B", matched: true }], unmatched: [] } },
      { tool: "top_tracks", ok: true, output: { summary: summary(a), checked: 12, skipped: a, songs: [] } },
      { tool: "top_tracks", ok: true, output: { summary: summary(b), checked: 9, skipped: b, songs: [] } },
    ];
    const totals = fromLearnOutputs(results);
    const funnel = funnelOf(totals);
    const left = funnel.find((x) => x.key === "leftOut")!.value;
    expect(left).toBe(4 + 1 + 2 + 1 + 0 + 3);
    expect(left).toBe(skippedOf(totals));
    expect(funnel.find((x) => x.key === "songsChecked")!.value).toBe(21);
    expect(funnel.find((x) => x.key === "artists")!.value).toBe(2);
    // The cards say the same numbers the funnel adds up.
    const cards = results.filter((r) => r.tool === "top_tracks").map((r) => plainStep({ tool: r.tool, status: "done", output: r.output }).headline);
    const stated = cards.flatMap((c) => [...c.matchAll(/(\d+) songs suggested before and (\d+) you dismissed/g)].map((m) => Number(m[1]) + Number(m[2])));
    expect(stated.reduce((x, y) => x + y, 0)).toBe(4 + 1 + 1 + 0);
    expect(plainStep({ tool: "match_playlist", status: "done", output: results[0].output }).headline).toBe(`Matched your 5 songs to ${funnel.find((x) => x.key === "artists")!.value} artists on Qloo`);
  });
});
