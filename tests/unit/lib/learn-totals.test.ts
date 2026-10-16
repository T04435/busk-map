import { describe, expect, it } from "vitest";
import { fromLearnOutputs } from "@/lib/learn-totals";

const ok = (tool: string, output: unknown) => ({ tool, ok: true, output });
const artist = (id: string, inPlaylist = false) => ({ artistId: id, name: id, affinity: 0.5, because: [], growth: null, alreadyInPlaylist: inPlaylist });

describe("learn totals", () => {
  it("counts each field over the finished tool calls", () => {
    const totals = fromLearnOutputs(
      [
        ok("match_playlist", { artists: [{ name: "A", matched: true }, { name: "B", matched: true }, { name: "C", matched: false }] }),
        ok("history", { earlierRuns: 2 }),
        ok("related_artists", { artists: [artist("x"), artist("y"), artist("seed", true)] }),
        ok("crowd_at", { pitch: "Bourke Street Mall", artists: [artist("y"), artist("z")] }),
        ok("crowd_at", { pitch: "Bourke Street Mall", artists: [artist("w")] }),
        ok("crowd_at", { pitch: "city", artists: [] }),
        ok("top_tracks", { checked: 6, skipped: { alreadySuggested: 2, dismissed: 1, canSing: 0 }, songs: [] }),
        ok("top_tracks", { checked: 4, skipped: { alreadySuggested: 0, dismissed: 1, canSing: 3 }, songs: [] }),
      ],
      { qlooCalls: 9, qlooCacheHits: 3 },
    );
    expect(totals).toEqual({ artists: 2, crowds: 1, liked: 4, songsChecked: 10, alreadySuggested: 2, dismissedSkipped: 2, alreadyKnown: 3, newSongs: 0, qlooCalls: 9, qlooCacheHits: 3 });
  });

  it("a failed tool, an error output or a budget skip counts 0", () => {
    const totals = fromLearnOutputs([
      { tool: "related_artists", ok: false },
      { tool: "crowd_at", ok: true, output: { error: "x" } },
      ok("related_artists", { skipped: "budget", summary: "used up" }),
      { tool: "top_tracks", ok: false, output: { checked: 5, skipped: { alreadySuggested: 5 } } },
    ]);
    expect(totals).toEqual({ artists: 0, crowds: 0, liked: 0, songsChecked: 0, alreadySuggested: 0, dismissedSkipped: 0, alreadyKnown: 0, newSongs: 0, qlooCalls: 0, qlooCacheHits: 0 });
  });

  it("newSongs is 0 until the run is accepted, then the count passed in", () => {
    expect(fromLearnOutputs([]).newSongs).toBe(0);
    expect(fromLearnOutputs([], { newSongs: 6 }).newSongs).toBe(6);
  });

  it("top_tracks keeps its `skipped` counts when it carries them (the budget skip is a string)", () => {
    expect(fromLearnOutputs([ok("top_tracks", { checked: 3, skipped: { alreadySuggested: 1, dismissed: 0, canSing: 0 } })]).alreadySuggested).toBe(1);
  });
});
