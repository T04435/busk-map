import { describe, expect, it } from "vitest";
import { venueDetail } from "@/lib/venue";

describe("venueDetail", () => {
  it("puts Qloo's live music flag, what the venue is good for and review keywords into a few words", () => {
    expect(venueDetail({ liveMusic: true, goodFor: ["Pub", "Inexpensive"], keywords: ["bands", "live music", "band room"] })).toBe(
      "live music, pub, known for “bands” and “band room”",
    );
    expect(venueDetail({ liveMusic: true, goodFor: ["Live music venue"], keywords: [] })).toBe("live music");
    expect(venueDetail({ liveMusic: false, goodFor: [], keywords: ["vegan"] })).toBe("known for “vegan”");
    expect(venueDetail({})).toBe("");
  });
});
