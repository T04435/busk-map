import { describe, expect, it } from "vitest";
import { mentionArtists } from "@/components/honeycomb/mention";

const a = (name: string) => ({ kind: "artist" as const, name });

describe("mentionArtists", () => {
  it("turns each artist the sentence names into its mention, in place", () => {
    expect(mentionArtists("Fans of Wolfine and Residente love this.", [a("Wolfine"), a("Residente")])).toEqual([
      "Fans of ",
      a("Wolfine"),
      " and ",
      a("Residente"),
      " love this.",
    ]);
  });

  it("adds the artists it doesn't name as 'Because a, b'", () => {
    expect(mentionArtists("Your crowd sings along.", [a("Vance Joy"), a("Hollow Coves")])).toEqual([
      "Your crowd sings along.",
      " Because ",
      a("Vance Joy"),
      ", ",
      a("Hollow Coves"),
    ]);
  });

  it("matches the longer name first", () => {
    expect(mentionArtists("Fans of Angus & Julia Stone.", [a("Angus"), a("Angus & Julia Stone")])).toEqual([
      "Fans of ",
      a("Angus & Julia Stone"),
      ".",
      " Because ",
      a("Angus"),
    ]);
  });
});
