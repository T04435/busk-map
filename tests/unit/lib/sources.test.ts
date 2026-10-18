import { describe, expect, it } from "vitest";
import { creditsClaude, explainedByLabel, explanationsLabel, modelName } from "@/lib/sources";

describe("explanations label and Claude credit (B-007)", () => {
  it("names the model that wrote the explanations", () => {
    expect(explanationsLabel({ explanations: "ai", explanationsModel: "claude" })).toBe("Written by Hive");
    expect(explanationsLabel({ explanations: "ai", explanationsModel: "mock" })).toBe("Explanations: test model (offline)");
    expect(explanationsLabel({ explanations: "template", explanationsModel: null })).toBe("Explanations: from the data");
    // Plans stored before the field existed were written by Claude.
    expect(explanationsLabel({ explanations: "ai" })).toBe("Written by Hive");
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
    expect(modelName("claude")).toBe("the Hive");
    expect(modelName("claude", "start")).toBe("The Hive");
    expect(modelName("claude", "label")).toBe("Hive");
    expect(modelName("mock")).toBe("the test model");
    expect(modelName("mock", "start")).toBe("The test model");
    expect(modelName("mock", "label")).toBe("Test model");
    // Template text and older plans count as Claude, like the chip.
    expect(modelName(null)).toBe("the Hive");
    expect(modelName(undefined, "start")).toBe("The Hive");
  });

  it("labels the pitch card badge", () => {
    expect(explainedByLabel("claude")).toBe("Explained by the Hive");
    expect(explainedByLabel(null)).toBe("Explained by the Hive");
    expect(explainedByLabel("mock")).toBe("Explained by the test model (offline)");
  });
});
