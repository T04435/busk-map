import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { genreOptions, ResearchAsk } from "@/components/playlist/research-ask";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { ResearchSuggest } from "@/lib/repertoire-research";

const SUGGEST: ResearchSuggest = {
  artists: [{ name: "Dny Omy", spotifyId: "MockSpotifyOnlyArt0001", image: "https://i.scdn.co/image/x" }, { name: "Lkm Kimi" }],
  genres: [
    { id: "urn:tag:genre:qloo:dembow", name: "Dembow", from: "act", picked: true },
    { id: "urn:tag:genre:music:reggae", name: "Reggae", from: "act", picked: true },
    { id: "urn:tag:genre:qloo:reggaeton", name: "Reggaeton", from: "alikes", picked: false },
  ],
};

describe("the research ask starts from what the research found", () => {
  it("quick picks: the suggestions not selected to start with, then the broad genres, once each", () => {
    const options = genreOptions(SUGGEST);
    expect(options[0]).toBe("Reggaeton");
    expect(options).not.toContain("Dembow");
    expect(options.filter((o) => o.toLowerCase() === "reggae")).toHaveLength(1);
    expect(options).toEqual(expect.arrayContaining([...PLAYLIST_COPY.research.genrePick.options]));
    expect(genreOptions(null)).toEqual([...PLAYLIST_COPY.research.genrePick.options]);
  });

  it("the found sound-alikes are prefilled chips and the confident genres are picked chips, so Carry on is ready", () => {
    const html = renderToStaticMarkup(createElement(ResearchAsk, { message: "Ask", busy: false, onSubmit: () => undefined, suggest: SUGGEST }));
    expect(html).toContain("Dny Omy");
    expect(html).toContain("Lkm Kimi");
    expect(html).toContain("2 of 10");
    const chips = [...html.matchAll(/aria-label="Remove ([^"]+)"/g)].map((m) => m[1]);
    expect(chips).toEqual(["Dny Omy", "Lkm Kimi", "Dembow", "Reggae"]);
    // Reggae, picked, is also pressed among the quick picks; the search box is there.
    const pressed = [...html.matchAll(/<button[^>]*aria-pressed="true"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(pressed).toEqual(["Reggae"]);
    expect(html).toContain('data-testid="research-genre-search"');
    expect(html).toMatch(/data-testid="research-ask-carry-on"(?![^>]*disabled)/);
  });

  it("nothing found: empty picker, no genre pressed, Carry on waits", () => {
    const html = renderToStaticMarkup(createElement(ResearchAsk, { message: "Ask", busy: false, onSubmit: () => undefined }));
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).not.toContain('data-testid="research-genres-picked"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*data-testid="research-ask-carry-on"|data-testid="research-ask-carry-on"[^>]*disabled/);
  });
});

describe("a genre-based research step names its genres", () => {
  it("What your fans also love: 'Based on Dembow and Reggaeton: your fans also love …'; the artists-like-you line stays as it is", async () => {
    const { TOOL_UI } = await import("@/components/plan/tool-results");
    const line = TOOL_UI.research_fans_love.line!;
    const text = (o: Record<string, unknown>) => JSON.stringify(line(o));
    const artists = [{ name: "Artist A", qlooId: "q1" }];
    expect(text({ artists, basedOn: "genres", byGenres: ["Dembow", "Reggaeton"] })).toContain("Based on Dembow and Reggaeton: your fans also love ");
    expect(text({ artists, basedOn: "soundsLike" })).toContain('"Your fans also love "');
  });
});

describe("the Hive's genre suggestions in the ask", () => {
  it("follow the agent's tag among the quick picks, after the research's own, and are never selected", () => {
    const suggest: ResearchSuggest = {
      artists: [],
      genres: [
        { id: "urn:tag:genre:qloo:reggaeton", name: "Reggaeton", from: "alikes", picked: true },
        { id: "urn:tag:genre:qloo:dembow", name: "Dembow", from: "alikes", picked: false },
        { id: "urn:tag:genre:music:funk", name: "Funk", from: "hive", picked: false },
      ],
      hiveBy: "mock",
    };
    expect(genreOptions(suggest).slice(0, 2)).toEqual(["Dembow", "Funk"]);
    const html = renderToStaticMarkup(createElement(ResearchAsk, { message: "Ask", busy: false, onSubmit: () => undefined, suggest }));
    expect(html).toMatch(/data-slot="agent-tag"[\s\S]*Test model[\s\S]*data-source="hive"[^>]*>Funk</);
    expect(html).not.toMatch(/aria-pressed="true"[^>]*data-source="hive"|data-source="hive"[^>]*aria-pressed="true"/);
    expect([...html.matchAll(/aria-label="Remove ([^"]+)"/g)].map((m) => m[1])).toEqual(["Reggaeton"]);
  });
});
