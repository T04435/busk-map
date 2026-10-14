import { EXAMPLES } from "../../src/lib/examples";
import { expect, LOCAL, test, waitForPlan } from "./fixtures";

test.describe("landing", () => {
  test("shows the three example performers and the own-act form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
    for (const example of EXAMPLES) await expect(page.getByRole("link", { name: new RegExp(example.label) })).toBeVisible();
    await expect(page.getByRole("form", { name: "Plan for your own act" })).toBeVisible();
  });
});

for (const example of EXAMPLES) {
  test.describe(`example: ${example.label}`, () => {
    test("opens instantly with three scored pitches, a map and a setlist", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name: new RegExp(example.label) }).click();
      await expect(page).toHaveURL(new RegExp(`/plan\\?example=${example.id}`));
      await expect(page.getByRole("heading", { level: 1, name: example.performer.name })).toBeVisible();
      await waitForPlan(page);

      const pitches = page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem");
      await expect(pitches).toHaveCount(3);
      await expect(page.getByRole("region", { name: "Map of pitches and taste affinity" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /^Setlist for / })).toBeVisible();
      await expect(page.getByText("Explanations: from the data")).toBeVisible();
      // Every data source is credited.
      for (const credit of ["Taste data by Qloo", "Pedestrian counts: City of Melbourne Open Data", "Weather data by Open-Meteo.com"]) {
        await expect(page.getByRole("link", { name: credit })).toBeVisible();
      }
      if (LOCAL) await expect(page.getByText("Synthetic Qloo data (key pending)")).toBeVisible();
    });

    test("selects a pitch from the keyboard and keeps it in the URL", async ({ page }) => {
      await page.goto(`/plan?example=${example.id}`);
      await waitForPlan(page);
      const second = page.getByRole("region", { name: "Pitches", exact: true }).getByRole("button").nth(1);
      const name = (await second.innerText()).split("\n")[0].replace(/^2\.\s*/, "").trim();
      await second.focus();
      await page.keyboard.press("Enter");
      await expect(second).toHaveAttribute("aria-pressed", "true");
      await expect(page).toHaveURL(/pitch=/);
      await expect(page.getByRole("heading", { name: `Setlist for ${name}` })).toBeVisible();

      // The selection survives a reload (shareable link).
      await page.reload();
      await expect(page.getByRole("heading", { name: `Setlist for ${name}` })).toBeVisible();
    });
  });
}

test.describe("live agent (mock model offline)", () => {
  test.skip(!LOCAL, "Runs the agent; only against the local offline server to avoid spend");

  test("streams the agent's steps and swaps in its explanations", async ({ page }) => {
    await page.goto("/plan?example=acoustic");
    await waitForPlan(page);
    await page.getByRole("button", { name: "Plan with the agent (live)" }).click();
    const steps = page.getByRole("list", { name: "Agent steps" });
    await expect(steps.getByText("Matching your artists to Qloo")).toBeVisible();
    await expect(steps.getByText("Scoring legal pitches")).toBeVisible();
    await expect(page.getByText("Explanations: Claude")).toBeVisible();
    await expect(page.getByText(/^Mock explanation/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Re-run the agent" })).toBeEnabled();
  });

  test("shows the plain-LLM comparison, clearly labelled", async ({ page }) => {
    await page.goto("/plan?example=sax");
    await waitForPlan(page);
    await page.getByRole("switch", { name: "What a plain LLM would suggest" }).click();
    await expect(page.getByText("Plain LLM answer (unverified, no data)")).toBeVisible();
    await expect(page.getByText(/Mock plain-LLM answer/)).toBeVisible();
  });
});
