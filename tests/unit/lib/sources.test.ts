import { describe, expect, it } from "vitest";
import { creditsClaude, explanationsLabel } from "@/lib/sources";

describe("explanations label and Claude credit (B-007)", () => {
  it("names the model that wrote the explanations", () => {
    expect(explanationsLabel({ explanations: "ai", explanationsModel: "claude" })).toBe("Explanations: Claude");
    expect(explanationsLabel({ explanations: "ai", explanationsModel: "mock" })).toBe("Explanations: test model (offline)");
    expect(explanationsLabel({ explanations: "template", explanationsModel: null })).toBe("Explanations: from the data");
    // Plans stored before the field existed were written by Claude.
    expect(explanationsLabel({ explanations: "ai" })).toBe("Explanations: Claude");
  });

  it("credits Claude only when Claude wrote them", () => {
    expect(creditsClaude({ explanations: "ai", explanationsModel: "claude" })).toBe(true);
    expect(creditsClaude({ explanations: "ai", explanationsModel: null })).toBe(true);
    expect(creditsClaude({ explanations: "ai", explanationsModel: "mock" })).toBe(false);
    expect(creditsClaude({ explanations: "template", explanationsModel: null })).toBe(false);
  });
});
