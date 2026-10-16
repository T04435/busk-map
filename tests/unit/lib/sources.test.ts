import { describe, expect, it } from "vitest";
import { creditsClaude, explainedByLabel, explanationsLabel, modelName } from "@/lib/sources";

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

describe("model name in running text (B-010)", () => {
  it("names Claude, or the test model when the mock model wrote it", () => {
    expect(modelName("claude")).toBe("Claude");
    expect(modelName("claude", "start")).toBe("Claude");
    expect(modelName("claude", "label")).toBe("Claude");
    expect(modelName("mock")).toBe("the test model");
    expect(modelName("mock", "start")).toBe("The test model");
    expect(modelName("mock", "label")).toBe("Test model");
    // Template text and older plans count as Claude, like the chip.
    expect(modelName(null)).toBe("Claude");
    expect(modelName(undefined, "start")).toBe("Claude");
  });

  it("labels the pitch card badge", () => {
    expect(explainedByLabel("claude")).toBe("Explained by Claude");
    expect(explainedByLabel(null)).toBe("Explained by Claude");
    expect(explainedByLabel("mock")).toBe("Explained by the test model (offline)");
  });
});
