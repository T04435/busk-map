import { describe, expect, it } from "vitest";
import { parsePlanParams, planSearchParams } from "@/lib/plan-url";
import { songKey, nameKey, trackKey } from "@/lib/text";
import { parseSongLines } from "@/components/landing/performer-form";

const today = "2026-10-15";

describe("plan URL state", () => {
  it("loads an example performer with its default slot", () => {
    const parsed = parsePlanParams({ example: "acoustic" }, today);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.exampleId).toBe("acoustic");
    expect(parsed.request.slot).toEqual({ date: "2026-10-17", startHour: 18, endHour: 21 });
    expect(parsed.autoRun).toBe(false);
  });

  it("round-trips a custom performer, weights and the selected pitch", () => {
    const first = parsePlanParams(
      {
        name: "Jess",
        artists: "Paul Kelly|Courtney Barnett",
        songs: "Gravy~Paul Kelly|Mine~Jess~own",
        date: "2026-10-18",
        from: "12",
        to: "15",
        permit: "premium",
        w: "0.5,0.2,0.1,0.1,0.3",
        pitch: "site:com-21",
        run: "1",
      },
      today,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.request.performer.songs).toEqual([
      { title: "Gravy", artist: "Paul Kelly", own: false },
      { title: "Mine", artist: "Jess", own: true },
    ]);
    expect(first.request.weights).toEqual({ taste: 0.5, footfall: 0.2, places: 0.1, events: 0.1, weather: 0.3 });
    expect(first).toMatchObject({ pitchId: "site:com-21", autoRun: true, exampleId: null });

    const again = parsePlanParams(Object.fromEntries(planSearchParams(first.request)), today);
    expect(again.ok && again.request).toEqual(first.request);
  });

  it("rejects incomplete or invalid plans with a readable error", () => {
    expect(parsePlanParams({}, today)).toEqual({ ok: false, error: expect.stringMatching(/example/) });
    const bad = parsePlanParams({ name: "X", artists: "", date: "2026-10-18" }, today);
    expect(bad.ok).toBe(false);
    const badSlot = parsePlanParams({ example: "sax", from: "20", to: "18" }, today);
    expect(badSlot).toMatchObject({ ok: false, error: expect.stringMatching(/slot/) });
  });

  it("ignores malformed weights and array params", () => {
    const parsed = parsePlanParams({ example: ["folk-duo", "sax"], w: "1,2" }, today);
    expect(parsed.ok && parsed.request.weights).toBeUndefined();
    expect(parsed.ok && parsed.request.slot.date).toBe("2026-10-18");
  });
});

describe("song lines and keys", () => {
  it("parses one song per line, with own songs flagged", () => {
    expect(parseSongLines("How to Make Gravy - Paul Kelly\n\nMy Tune (own)\nSong|One – Band~X")).toEqual([
      { title: "How to Make Gravy", artist: "Paul Kelly", own: false },
      { title: "My Tune", artist: "Unknown artist", own: true },
      // URL separators are stripped; an en dash also separates title and artist.
      { title: "Song One", artist: "Band X", own: false },
    ]);
  });

  it("normalises titles and names", () => {
    expect(songKey("Riptide - Live at the Forum")).toBe("riptide");
    expect(nameKey("The Paper Kites")).toBe("paper kites");
    expect(trackKey("The Paper Kites", "Bloom (Remastered)")).toBe("paper kites|bloom");
  });
});
