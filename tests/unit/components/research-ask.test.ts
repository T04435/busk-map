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
  it("broad quick picks: the fixed genres less the suggested ones", () => {
    const options = genreOptions(SUGGEST);
    expect(options).not.toContain("Reggae");
    expect(options).toEqual(PLAYLIST_COPY.research.genrePick.options.filter((o) => o !== "Reggae"));
    expect(genreOptions(null)).toEqual([...PLAYLIST_COPY.research.genrePick.options]);
  });

  it("the found sound-alikes are prefilled chips and the preselected genres are picked chips; the rest are on the Suggested row", () => {
    const html = renderToStaticMarkup(createElement(ResearchAsk, { message: "Ask", busy: false, onSubmit: () => undefined, suggest: SUGGEST }));
    expect(html).toContain("2 of 10");
    const chips = [...html.matchAll(/aria-label="Remove ([^"]+)"/g)].map((m) => m[1]);
    expect(chips).toEqual(["Dny Omy", "Lkm Kimi", "Dembow", "Reggae"]);
    expect(html).toMatch(/data-testid="research-genre-suggested"[\s\S]*Suggested[\s\S]*Reggaeton/);
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toContain('data-testid="research-genre-search"');
    expect(html).toMatch(/data-testid="research-ask-carry-on"(?![^>]*disabled)/);
  });

  it("nothing found: empty picker, no genre picked, Carry on waits", () => {
    const html = renderToStaticMarkup(createElement(ResearchAsk, { message: "Ask", busy: false, onSubmit: () => undefined }));
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).not.toContain('data-testid="research-genres-picked"');
    expect(html).not.toContain('data-testid="research-genre-suggested"');
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
  it("carry the Hive's mark on the Hive-only ones, picked or not; agreed ones don't need it", () => {
    const suggest: ResearchSuggest = {
      artists: [],
      genres: [
        { id: "urn:tag:genre:qloo:reggaeton", name: "Reggaeton", from: "alikes", picked: true, agreed: true },
        { id: "urn:tag:genre:qloo:cubaton", name: "Cubaton", from: "hive", picked: true },
        { id: "urn:tag:genre:music:tropical", name: "Tropical", from: "alikes", picked: true },
        { id: "urn:tag:genre:music:funk", name: "Funk", from: "hive", picked: false },
      ],
      hiveBy: "mock",
    };
    const html = renderToStaticMarkup(createElement(ResearchAsk, { message: "Ask", busy: false, onSubmit: () => undefined, suggest }));
    expect([...html.matchAll(/aria-label="Remove ([^"]+)"/g)].map((m) => m[1])).toEqual(["Reggaeton", "Cubaton", "Tropical"]);
    const hive = [...html.matchAll(/<button[^>]*data-source="hive"[^>]*>/g)].map((m) => m[0]);
    expect(hive).toHaveLength(2);
    expect(hive[0]).toContain('aria-label="Remove Cubaton"');
    expect(hive.every((b) => /title="Test model(&#x27;|')s suggestion"/.test(b))).toBe(true);
    expect(html).not.toContain('data-slot="agent-tag"');
  });
});
