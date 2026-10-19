import { describe, expect, it } from "vitest";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { endOf } from "@/server/learn/replay";

const end = PLAYLIST_COPY.learn.end;
const hint = PLAYLIST_COPY.learn.nothingNewHint;

describe("the nothing-new ending (B-029)", () => {
  it("with songs checked and all left out: says how many were left out and what to try", () => {
    expect(end({ ok: true, mode: "agent", code: "nothing_new", newCount: 0, skippedCount: 7, songsChecked: 22 })).toBe(`Nothing new this time: we left out 7 songs you've already seen. ${hint}`);
    expect(hint).toBe("Try again after a new busk, or after you've learned a few songs.");
  });

  it("with no songs checked: says so, and never claims everything was suggested before", () => {
    const message = end({ ok: true, mode: "fallback", code: "nothing_new", newCount: 0, skippedCount: 0, songsChecked: 0 });
    expect(message).toBe(`Couldn't find songs to check this time. ${hint}`);
    expect(message).not.toMatch(/suggested before|left out/);
  });

  it("the end event takes the checked count from the run's totals, live and on replay", () => {
    const base = { id: "r", status: "done" as const, endCode: "nothing_new", model: "claude" as const, newCount: 0, skippedCount: 0 };
    expect(endOf({ ...base, totals: { songsChecked: 0 } }).message).toMatch(/^Couldn't find songs to check/);
    expect(endOf({ ...base, skippedCount: 5, totals: { songsChecked: 9 } }).message).toMatch(/^Nothing new this time: we left out 5 songs you've already seen\./);
    // A run with no stored totals (pruned or older): the left-out count decides.
    expect(endOf({ ...base, skippedCount: 5, totals: null }).message).toMatch(/^Nothing new this time: we left out 5 songs you've already seen\./);
  });
});
