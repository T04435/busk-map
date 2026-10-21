import { describe, expect, it } from "vitest";
import {
  ACCEPT_SCORE,
  ASK_SCORE,
  MAX_EXTRA_SEARCHES,
  cleanName,
  decideMatch,
  genreOverlap,
  hasMusicGenre,
  isOtherSpotifyArtist,
  nameVariants,
  normName,
  scoreCandidate,
  searchPlan,
  shortForm,
  similarity,
  usableTagNames,
  type MatchCandidate,
} from "@/lib/qloo-match";

const cand = (id: string, name: string, over: Partial<MatchCandidate> = {}): MatchCandidate => ({ id, name, popularity: null, genres: [], image: null, ...over });
const variantsOf = (...names: string[]) => nameVariants(names);

describe("name variants for the Qloo search", () => {
  it("strips accents, brackets and feat. parts, toggles The, and adds the short form", () => {
    expect(cleanName("Zélia Marquez (feat. Ro Dias)")).toBe("Zélia Marquez");
    expect(cleanName("Nova Kid [Live] ft. Someone")).toBe("Nova Kid");
    expect(cleanName("Plain Name")).toBe("Plain Name");
    expect(shortForm("Al2 El Aldeano")).toBe("Al2");
    expect(shortForm("Ana y Los Soles")).toBe("Ana");
    expect(shortForm("Solo")).toBeNull();
    const texts = variantsOf("Al2 El Aldeano").map((v) => v.text);
    expect(texts).toEqual(["Al2 El Aldeano", "The Al2 El Aldeano", "Al2"]);
    expect(variantsOf("The Paper Kites").map((v) => v.text)).toEqual(["The Paper Kites", "Paper Kites"]);
    expect(variantsOf("Zélia Marquez (feat. Ro Dias)").map((v) => [v.text, v.kind])).toEqual([
      ["Zélia Marquez (feat. Ro Dias)", "exact"],
      ["Zélia Marquez", "clean"],
      ["The Zélia Marquez", "clean"],
    ]);
  });

  it("uses the act name as a long or short form, and dedupes variants that differ only by accents, case or punctuation", () => {
    const texts = variantsOf("Al2 El Aldeano", "Al2").map((v) => v.text);
    expect(texts).toContain("Al2");
    expect(new Set(texts.map((t) => t.toLowerCase())).size).toBe(texts.length);
    expect(variantsOf("Beyoncé", "Beyonce", "BEYONCÉ!").map((v) => v.text)).toEqual(["Beyoncé", "The Beyoncé"]);
    expect(nameVariants([null, undefined, "  "])).toEqual([]);
  });

  it("the search plan is the Spotify name first and at most four more", () => {
    const plan = searchPlan(["Aaa Bbb (feat. Ccc) y Ddd", "Aaa Bbb Long Form", "The Other One"]);
    expect(plan[0]).toBe("Aaa Bbb (feat. Ccc) y Ddd");
    expect(plan.length).toBeLessThanOrEqual(1 + MAX_EXTRA_SEARCHES);
    expect(searchPlan(["Solo"])).toEqual(["Solo", "The Solo"]);
  });
});

describe("similarity and genres", () => {
  it("normalises accents, punctuation, & and a leading The", () => {
    expect(normName("The Smith Street Band")).toBe("smith street band");
    expect(normName("Angus & Julia Stone")).toBe("angus and julia stone");
    expect(normName("Zélia  Marquez!")).toBe("zelia marquez");
    expect(similarity("Mara Ellis", "mara ellis")).toBe(1);
    expect(similarity("Mara Ellis", "Mara Ellison")).toBeGreaterThan(0.8);
    expect(similarity("Mara Ellis", "Qzx Nowhere")).toBeLessThan(0.3);
  });

  it("genres overlap by a shared word; pop alone is too broad", () => {
    expect(genreOverlap(["indie folk"], ["Indie Folk", "Rock"])).toBe(true);
    expect(genreOverlap(["folk"], ["Indie Folk"])).toBe(true);
    expect(genreOverlap(["synthetic ambient"], ["Rock", "Pop"])).toBe(false);
    expect(genreOverlap(["pop"], ["Pop"])).toBe(false);
    expect(genreOverlap([], ["Rock"])).toBe(false);
  });
});

describe("the confidence rule", () => {
  const v = variantsOf("Zélia Marquez (feat. Ro Dias)");

  it("scores a name equal to the Spotify name or its clean form as 1, a short form as 0.8, a near miss as at most 0.85 x similarity", () => {
    expect(scoreCandidate(cand("a", "Zelia Marquez"), v, []).score).toBe(1);
    expect(scoreCandidate(cand("a", "Zelia Marquez"), v, []).basis).toBe("clean");
    const short = variantsOf("Al2 El Aldeano");
    expect(scoreCandidate(cand("a", "Al2"), short, [])).toMatchObject({ score: 0.8, basis: "short" });
    const near = scoreCandidate(cand("a", "Mara Ellison"), variantsOf("Mara Ellis"), []);
    expect(near.basis).toBe("near");
    expect(near.score).toBeLessThan(0.85);
  });

  it("a shared genre adds 0.1 and so lets a short form through", () => {
    const short = variantsOf("Al2 El Aldeano");
    expect(decideMatch([cand("a", "Al2", { genres: ["Hip Hop"] })], short, ["hip hop"]).kind).toBe("match");
    // Without it, a short form alone is a question, not an answer.
    const asked = decideMatch([cand("a", "Al2", { genres: ["Rock"] })], short, ["hip hop"]);
    expect(asked.kind).toBe("ask");
    expect(ACCEPT_SCORE).toBeGreaterThan(0.8);
  });

  it("accepts one clear match", () => {
    const d = decideMatch([cand("a", "Zelia Marquez", { genres: ["Indie Folk"] }), cand("b", "Zelia Marques")], v, ["indie folk"]);
    expect(d.kind).toBe("match");
    if (d.kind === "match") expect(d.best.id).toBe("a");
  });

  it("two namesakes are a question unless a genre tells them apart", () => {
    const twins = [cand("a", "Mara Ellis", { genres: ["Rock"] }), cand("b", "Mara Ellis", { genres: ["Folk"] })];
    const v2 = variantsOf("Mara Ellis");
    expect(decideMatch(twins, v2, ["synthetic ambient"]).kind).toBe("ask");
    const settled = decideMatch(twins, v2, ["folk"]);
    expect(settled.kind).toBe("match");
    if (settled.kind === "match") expect(settled.best.id).toBe("b");
  });

  it("near misses are shown, best first and at most three, popularity ordering equal scores", () => {
    const v2 = variantsOf("Mara Ellis");
    const d = decideMatch(
      [cand("a", "Maria Ellis"), cand("b", "Mara Ellison"), cand("c", "Mara Ellis Quartet", { popularity: 0.9 }), cand("d", "Mara Ellis Trio", { popularity: 0.1 }), cand("e", "Zzz")],
      v2,
      [],
    );
    expect(d.kind).toBe("ask");
    if (d.kind === "ask") {
      expect(d.candidates.length).toBeLessThanOrEqual(3);
      expect(d.candidates.every((c) => c.score >= ASK_SCORE && c.score < ACCEPT_SCORE)).toBe(true);
      expect(d.candidates.map((c) => c.id)).not.toContain("e");
      const scores = d.candidates.map((c) => c.score);
      expect(scores).toEqual([...scores].sort((x, y) => y - x));
    }
  });

  it("nothing close is none; duplicates by id count once", () => {
    expect(decideMatch([], v, []).kind).toBe("none");
    expect(decideMatch([cand("a", "Qzx Nowhere")], variantsOf("Mara Ellis"), []).kind).toBe("none");
    expect(decideMatch([cand("a", "Zelia Marquez"), cand("a", "Zelia Marquez")], v, ["x"]).kind).toBe("match");
  });

  it("a generic short first name with unrelated genres is asked about, never picked silently (the 'Fabrizio' mismatch)", () => {
    // The act is a Spanish-language singer; Qloo's only close name is a Dutch Nederpop artist who goes by the same first name.
    const v3 = variantsOf("Fabrizio");
    const nederpop = cand("nl", "Fabrizio", { genres: ["Nederpop", "Dutch Pop"], popularity: 0.4 });
    const other = cand("it", "Fabrizio De André", { genres: ["Cantautore", "Italian Folk"], popularity: 0.6 });
    // A bare name equal to the Spotify name is a name match, but the profile's genres say otherwise: with a namesake in the pool it asks.
    const asked = decideMatch([nederpop, other], v3, ["latin alternative", "indie latino"]);
    expect(asked.kind).toBe("ask");
    // Alone, the exact bare name is still only a question when the genres share nothing.
    const lone = decideMatch([nederpop], v3, ["latin alternative"]);
    expect(lone.kind).toBe("ask");
    if (lone.kind === "ask") expect(lone.candidates[0].score).toBeLessThan(ACCEPT_SCORE);
    // With a genre in common, or no genres to compare, it passes as before.
    expect(decideMatch([nederpop], v3, ["dutch pop"]).kind).toBe("match");
    expect(decideMatch([{ ...nederpop, genres: [] }], v3, ["latin alternative"]).kind).toBe("match");
    // A full stage name is not generic.
    expect(decideMatch([cand("x", "Julia Jacklin", { genres: ["Folk"] })], variantsOf("Julia Jacklin"), ["synthetic ambient"]).kind).toBe("match");
  });
});

describe("guards against a wrong or empty Qloo match", () => {
  it("a name hit with another Spotify id is another artist; no id on either side proves nothing", () => {
    expect(isOtherSpotifyArtist("AAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBB")).toBe(true);
    expect(isOtherSpotifyArtist("AAAAAAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAAAA")).toBe(false);
    expect(isOtherSpotifyArtist(null, "BBBBBBBBBBBBBBBBBBBBBB")).toBe(false);
    expect(isOtherSpotifyArtist("AAAAAAAAAAAAAAAAAAAAAA", undefined)).toBe(false);
  });

  it("only a urn:tag:genre:music tag counts as a music genre", () => {
    expect(hasMusicGenre({ tags: [{ id: "urn:tag:genre:music:folk" }] })).toBe(true);
    expect(hasMusicGenre({ tags: [{ id: "urn:tag:keyword:qloo:x" }, { id: "urn:tag:genre:media:drama" }] })).toBe(false);
    expect(hasMusicGenre({ tags: [] })).toBe(false);
  });

  it("Last.fm tags are cleaned: no 'seen live', places, years, the act's own name; lowercased, once each, in order", () => {
    const tags = ["Folk", "seen live", "Australian", "folk", "80s", "My Act", "indie rock", "under 2000 listeners", "x", "  Singer  Songwriter "];
    expect(usableTagNames(tags, ["My Act"])).toEqual(["folk", "indie rock", "singer songwriter"]);
    expect(usableTagNames(tags, ["My Act"], 2)).toEqual(["folk", "indie rock"]);
  });
});
