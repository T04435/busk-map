import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CityPicker } from "@/components/forms/city-picker";
import { MELBOURNE_OPTION } from "@/lib/city";
import { PermitPicker } from "@/components/forms/permit-picker";
import { ArtistPicker } from "@/components/landing/artist-picker";
import { PicksList, type PickedSong } from "@/components/landing/repertoire-picker";

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

describe("CityPicker (any city)", () => {
  it("is a field button naming the picked city, labelled, with the search in a popover", () => {
    const tokyo = { id: "tokyo-jp", name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo", region: "Tokyo" };
    const out = html(createElement(CityPicker, { value: tokyo, onChange: () => {} }));
    expect(out).toContain(">City<");
    expect(out).toContain("Tokyo, Japan");
    expect(out).toContain('aria-haspopup="dialog"');
    expect(out).toContain('data-city="tokyo-jp"');
    // No listbox until the popover opens.
    expect(out).not.toContain('role="listbox"');
  });

  it("starts on Melbourne", () => {
    expect(html(createElement(CityPicker, { value: MELBOURNE_OPTION, onChange: () => {} }))).toContain("Melbourne, Victoria, Australia");
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

describe("PicksList (B-176)", () => {
  const song = (over: Partial<PickedSong>): PickedSong => ({ key: "a", title: "A very long song title that must never be lost", artist: "Artist", album: null, image: null, durationMs: 180000, own: false, ...over });
  it("has the Your picks header with the count and total time, and no Your song tag (the user removed it, 18 Oct)", () => {
    const out = html(createElement(PicksList, { songs: [song({ own: true }), song({ key: "b", durationMs: 60000 })], onRemove: () => {} }));
    expect(out).toContain("Your picks");
    expect(out).toContain("2 songs");
    expect(out).toContain("4:00");
    expect(out).not.toContain("Your song");
  });
});
