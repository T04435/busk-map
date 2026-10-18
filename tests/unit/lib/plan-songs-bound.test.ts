import { describe, expect, it } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { boundSongs, PLAN_PROMPT_SONGS, PLAN_SONGS_CONSIDERED } from "@/lib/plan-songs-bound";
import { planRequestSchema } from "@/lib/plan-schema";
import { planSearchParams } from "@/lib/plan-url";
import { buildPrompt } from "@/server/agent/agent";
import { PlanContext } from "@/server/agent/context";
import { OFFLINE } from "../../helpers";

/** U16: no cap on a Repertoire. The plan request takes all of it; the server bounds what it works on and what the model reads. */
const songs = (n: number, artists = 40) => Array.from({ length: n }, (_, i) => ({ title: `Song ${i}`, artist: `Artist ${i % artists}`, own: i % 3 === 0 }));
const request = (n: number) => planRequestSchema.parse({ city: "melbourne", slot: { date: "2026-10-17", startHour: 17, endHour: 20 }, performer: { ...EXAMPLES[0].performer, songs: songs(n) } });

describe("boundSongs", () => {
  it("leaves a Repertoire under the bound untouched (same songs, same order)", () => {
    const s = songs(PLAN_SONGS_CONSIDERED);
    expect(boundSongs(s, PLAN_SONGS_CONSIDERED)).toEqual(s);
  });

  it("takes songs round-robin across artists, in Repertoire order, and keeps own songs and covers", () => {
    const s = songs(200, 100);
    const out = boundSongs(s, 60);
    expect(out).toHaveLength(60);
    expect(new Set(out.map((x) => x.artist)).size).toBe(60);
    expect(out.map((x) => Number(x.title.slice(5)))).toEqual([...out.map((x) => Number(x.title.slice(5)))].sort((a, b) => a - b));
    expect(out.some((x) => x.own)).toBe(true);
    expect(out.some((x) => !x.own)).toBe(true);
  });

  it("gives one artist with many songs only its share once every artist has one", () => {
    const s = [...Array.from({ length: 150 }, (_, i) => ({ title: `Hit ${i}`, artist: "Prolific" })), ...Array.from({ length: 10 }, (_, i) => ({ title: `One ${i}`, artist: `Other ${i}` }))];
    const out = boundSongs(s, 40);
    expect(out.filter((x) => x.artist.startsWith("Other"))).toHaveLength(10);
    expect(out).toHaveLength(40);
  });
});

describe("a plan request with a long Repertoire", () => {
  it("accepts 200 songs (the old schema stopped at 60)", () => {
    const parsed = planRequestSchema.safeParse({ city: "melbourne", slot: { date: "2026-10-17", startHour: 17, endHour: 20 }, performer: { ...EXAMPLES[0].performer, songs: songs(200) } });
    expect(parsed.success).toBe(true);
    expect(parsed.data!.performer.songs).toHaveLength(200);
  });

  it("the engine works on the bounded set while the request keeps every song", () => {
    const ctx = new PlanContext(request(200), OFFLINE, "2026-10-15");
    expect(ctx.request.performer.songs).toHaveLength(200);
    expect(ctx.songs$).toHaveLength(PLAN_SONGS_CONSIDERED);
  });

  it("the model prompt lists at most PLAN_PROMPT_SONGS songs", () => {
    const ctx = new PlanContext(request(200), OFFLINE, "2026-10-15");
    const line = buildPrompt(ctx, []).split("\n").find((l) => l.startsWith("Can play: "))!;
    expect(line.split("; ")).toHaveLength(PLAN_PROMPT_SONGS);
    const short = new PlanContext(request(12), OFFLINE, "2026-10-15");
    expect(buildPrompt(short, []).split("\n").find((l) => l.startsWith("Can play: "))!.split("; ")).toHaveLength(12);
  });

  it("the /plan link carries only the bounded songs, so a long Repertoire still fits a URL", () => {
    const long = planSearchParams(request(200)).get("songs")!.split("|");
    expect(long).toHaveLength(PLAN_SONGS_CONSIDERED);
    expect(planSearchParams(request(30)).get("songs")!.split("|")).toHaveLength(30);
  });
});
