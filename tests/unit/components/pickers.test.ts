import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CityPicker } from "@/components/forms/city-picker";
import { PermitPicker } from "@/components/forms/permit-picker";
import { ArtistPicker } from "@/components/landing/artist-picker";
import { PickedSongs, type PickedSong } from "@/components/landing/repertoire-picker";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("PermitPicker counts (B-178)", () => {
  it("shows no pitch count without counts", () => {
    expect(html(createElement(PermitPicker, { value: "general", onValueChange: () => {} }))).not.toMatch(/\d+ pitch/);
  });
  it("ends each card with its pitch count when given", () => {
    const out = html(createElement(PermitPicker, { value: "general", onValueChange: () => {}, counts: { general: 24, premium: 30, "circle-act": 1 } }));
    expect(out).toContain("24 pitches");
    expect(out).toContain("30 pitches");
    expect(out).toContain("1 pitch<");
  });
});

describe("CityPicker (B-181)", () => {
  it("puts the footfall icon in the Live data badge", () => {
    const out = html(createElement(CityPicker, { cities: [{ id: "mel", name: "Melbourne", level: "live", note: "All sources" }], value: "mel", onValueChange: () => {} }));
    expect(out).toContain("Live data");
    expect(out).toContain("M3 20h18");
  });
});

describe("ArtistPicker (B-172, B-175)", () => {
  it("stacks chips in one column, tags typed ones TYPED without brackets, and puts the hint after the field", () => {
    const out = html(
      createElement(ArtistPicker, {
        value: [
          { name: "Gillian Welch", spotifyId: "1", image: null },
          { name: "My Friend", spotifyId: null, image: null },
        ],
        onChange: () => {},
        query: "",
        onQueryChange: () => {},
      }),
    );
    expect(out).toContain("flex-col");
    expect(out).toContain(">Typed<");
    expect(out).not.toContain("(typed)");
    expect(out).toContain('aria-label="Remove My Friend"');
    expect(out.indexOf('role="combobox"')).toBeLessThan(out.indexOf('data-testid="artists-hint"'));
  });
});

describe("PickedSongs (B-176)", () => {
  const song = (over: Partial<PickedSong>): PickedSong => ({ key: "a", title: "A very long song title that must never be lost", artist: "Artist", album: null, image: null, durationMs: 180000, own: false, ...over });
  it("has the Your picks header with the count and total time, and the Your song badge", () => {
    const out = html(createElement(PickedSongs, { songs: [song({ own: true }), song({ key: "b", durationMs: 60000 })], onRemove: () => {} }));
    expect(out).toContain("Your picks");
    expect(out).toContain("2 songs");
    expect(out).toContain("4:00");
    expect(out).toContain("Your song");
  });
});
