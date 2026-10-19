import { describe, expect, it } from "vitest";
import { artist, mentionsIn, song } from "@/lib/mention";

describe("mentionsIn (U05: names become mentions where they stand)", () => {
  it("replaces every known artist and song in place, with no tail", () => {
    const text = "Fans of Calle 13 and Zona Ganjah love this second Los Cafres song, so it suits the same listeners as Bastará.";
    const parts = mentionsIn(text, [artist("Calle 13", { image: "https://i.scdn.co/a" }), artist("Zona Ganjah"), artist("Los Cafres"), song("Bastará", { image: "https://i.scdn.co/c" })]);
    expect(parts).toEqual([
      "Fans of ",
      { kind: "artist", name: "Calle 13", image: "https://i.scdn.co/a", href: null },
      " and ",
      { kind: "artist", name: "Zona Ganjah", href: null },
      " love this second ",
      { kind: "artist", name: "Los Cafres", href: null },
      " song, so it suits the same listeners as ",
      { kind: "song", title: "Bastará", image: "https://i.scdn.co/c", href: null },
      ".",
    ]);
  });

  it("leaves unknown names and partial words as text", () => {
    expect(mentionsIn("Fans of Calle 130 love this.", [artist("Calle 13")])).toEqual(["Fans of Calle 130 love this."]);
  });

  it("prefers the entity that has a photo when two share a name", () => {
    const parts = mentionsIn("Like Bon Iver.", [artist("Bon Iver"), artist("Bon Iver", { image: "https://i.scdn.co/b" })]);
    expect(parts[1]).toMatchObject({ name: "Bon Iver", image: "https://i.scdn.co/b" });
  });
});
