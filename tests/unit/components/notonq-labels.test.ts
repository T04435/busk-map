import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtistChip } from "@/components/honeycomb/artist-chip";
import { ArtistProfile } from "@/components/honeycomb/artist-profile";
import { NotOnQTag } from "@/components/honeycomb/info-tag";
import { SongRow } from "@/components/honeycomb/song-row";
import { CrowdPanel } from "@/components/plan/crowd-panel";
import { toRepertoireView } from "@/lib/repertoire-research-view";
import type { ResearchSnapshot } from "@/lib/repertoire-research";
import type { Plan } from "@/lib/plan-schema";

/** NotOnQ's labels (lib/notonq.ts) in the shared components: what NotOnQ filled is labelled; Qloo's own data is left as it was. */
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const FILLED = "Filled by NotOnQ";

describe("NotOnQTag", () => {
  it("says 'Filled by NotOnQ', or names the stand-ins, as a neutral data tag (never the Qloo tone)", () => {
    const filled = html(createElement(NotOnQTag));
    expect(filled).toContain(FILLED);
    expect(filled).toContain('data-testid="notonq-filled"');
    expect(filled).toContain('data-tone="neutral"');
    const via = html(createElement(NotOnQTag, { standIns: ["Paul Kelly", "Courtney Barnett"] }));
    expect(via).toContain("Via NotOnQ stand-ins: Paul Kelly, Courtney Barnett");
    expect(via).toContain('data-testid="notonq-via"');
    expect(via).not.toContain("title=");
  });
});

describe("the shared artist and song components", () => {
  it("ArtistChip labels a filled artist at every size, and nothing else", () => {
    for (const size of ["xs", "md", "lg"] as const) {
      expect(html(createElement(ArtistChip, { name: "Nqo Filled", size, filledBy: "notonq" }))).toContain(FILLED);
      expect(html(createElement(ArtistChip, { name: "Paul Kelly", size }))).not.toContain("NotOnQ");
      expect(html(createElement(ArtistChip, { name: "Paul Kelly", size, filledBy: null }))).not.toContain("NotOnQ");
    }
  });

  it("SongRow and ArtistProfile label a filled artist", () => {
    expect(html(createElement(SongRow, { title: "A Song", artist: "Nqo Filled", filledBy: "notonq" }))).toContain(FILLED);
    expect(html(createElement(SongRow, { title: "A Song", artist: "Paul Kelly" }))).not.toContain("NotOnQ");
    const profile = { name: "Nqo Filled", genres: [], audience: [] };
    expect(html(createElement(ArtistProfile, { profile: { ...profile, filledBy: "notonq" } }))).toContain(FILLED);
    expect(html(createElement(ArtistProfile, { profile }))).not.toContain("NotOnQ");
  });
});

describe("the plan's crowd panel", () => {
  const crowd: Plan["crowd"] = {
    localArtists: [
      { name: "Nqo Filled", affinity: 0.5, because: [], explained: [], trend: null, filledBy: "notonq" },
      { name: "Paul Kelly", affinity: 0.6, because: [], explained: [], trend: null },
    ],
    usualCrowd: null,
    localScene: null,
    genres: [],
    contrast: null,
    demographics: null,
    drivers: [],
  };
  it("names the stand-ins once and labels only the filled artist", () => {
    const out = html(createElement(CrowdPanel, { crowd: { ...crowd, via: { by: "notonq", standIns: ["Paul Kelly"] } }, resolved: [], topPitch: null }));
    expect(out).toContain("Via NotOnQ stand-ins: Paul Kelly");
    expect(out.match(/Filled by NotOnQ/g)).toHaveLength(1);
    expect(html(createElement(CrowdPanel, { crowd: { ...crowd, localArtists: [crowd.localArtists[1]] }, resolved: [], topPitch: null }))).not.toContain("NotOnQ");
  });
});

describe("the research view model", () => {
  it("carries the act's filledBy, each artist's, and each result's stand-ins; nothing for research Qloo answered alone", () => {
    const via = { by: "notonq" as const, standIns: ["Paul Kelly", "Courtney Barnett"] };
    const snapshot = {
      version: 1,
      spotifyArtistId: "MockNotOnQFilledAct012",
      fullRunId: "r",
      runId: "r",
      runNumber: 1,
      mode: "full",
      at: "2026-10-29T00:00:00Z",
      steps: {
        profile: { status: "done", output: { summary: "", spotifyId: "MockNotOnQFilledAct012", name: "Nqo Filled", image: null, genres: [], followers: null, href: "https://open.spotify.com/artist/MockNotOnQFilledAct012" } },
        qloo: { status: "done", output: { summary: "", matched: true, qlooId: "x", name: "Nqo Filled", description: null, genres: [], audience: [], popularity: null, filledBy: "notonq" } },
        soundsLike: { status: "done", output: { summary: "", artists: [{ name: "Era Fill", qlooId: "y", affinity: null, filledBy: "notonq" }], saved: false, via } },
        fans: { status: "done", output: { summary: "", age: [], gender: [], ageLean: null, via } },
        fansLove: { status: "done", output: { summary: "", artists: [{ name: "Paul Kelly", qlooId: "z", affinity: 0.5 }], signalledBy: [], excluded: 0, via } },
      },
    } as unknown as ResearchSnapshot;
    const r = toRepertoireView({ snapshot }).results;
    expect(r.profile?.filledBy).toBe("notonq");
    expect(r.soundsLike?.[0].filledBy).toBe("notonq");
    expect(r.fansLove?.[0].filledBy).toBeUndefined();
    expect(r.standIns).toEqual({ soundsLike: via.standIns, fans: via.standIns, fansLove: via.standIns });
    const plain = structuredClone(snapshot);
    delete (plain.steps.qloo!.output as { filledBy?: unknown }).filledBy;
    for (const k of ["soundsLike", "fans", "fansLove"] as const) delete (plain.steps[k]!.output as { via?: unknown }).via;
    delete (plain.steps.soundsLike!.output!.artists[0] as { filledBy?: unknown }).filledBy;
    const p = toRepertoireView({ snapshot: plain }).results;
    expect(p.profile?.filledBy).toBeUndefined();
    expect(p.soundsLike?.[0].filledBy).toBeUndefined();
    expect(p.standIns).toEqual({});
  });
});

describe("the research step line for the act", () => {
  it("says NotOnQ filled the act in, never that it was found on Qloo", async () => {
    const { TOOL_UI } = await import("@/components/plan/tool-results");
    const line = TOOL_UI.research_qloo.line!({ matched: true, name: "Nqo Filled", filledBy: "notonq" });
    expect(JSON.stringify(line)).toContain("NotOnQ filled in");
    expect(JSON.stringify(line)).not.toContain(" on ");
    expect(JSON.stringify(TOOL_UI.research_qloo.line!({ matched: true, name: "Zelia Marquez" }))).toContain("Found ");
  });
});
