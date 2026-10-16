import { expect, isoDay, LOCAL, openDetails, SATURDAY, test, waitForPlan } from "./fixtures";

const ACT = `/plan?name=Tip%20Tester&artists=Paul%20Kelly&songs=Dumb%20Things~Paul%20Kelly&date=${SATURDAY}&from=18&to=21&permit=general`;

test.describe("tip log", () => {
  test("example plans show their example tip log, clearly labelled, and the bonus it adds", async ({ page }) => {
    await page.goto("/plan?example=acoustic");
    await waitForPlan(page);
    const history = page.getByTestId("tip-history");
    await expect(history).toContainText("Example data");
    // The example logs earn most at Albert Coates Lane and Centre Place (live and mock top-three pitches).
    await expect(history).toContainText(/(Albert Coates Lane|Centre Place) \(\+\d\)/);
    if (!LOCAL) return; // Live data may rank these pitches anywhere.
    const boosted = /adds a small bonus to (.+?) \(\+\d\)/.exec((await history.textContent()) ?? "")![1];
    const rows = page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem");
    const index = (await rows.locator("button[data-pitch-name]").evaluateAll((els, name) => els.findIndex((el) => el.getAttribute("data-pitch-name") === name), boosted));
    const sheet = await openDetails(page, index);
    await expect(sheet.getByTestId("tip-bonus")).toContainText(/Your tip log: 3 sessions here/);
  });

  async function planPitches(page: import("@playwright/test").Page) {
    const region = page.getByRole("region", { name: "Pitches", exact: true });
    const ids = await region.locator("li[data-pitch-id]").evaluateAll((els) => els.map((el) => el.getAttribute("data-pitch-id")!));
    const names = await region.locator("button[data-pitch-name]").evaluateAll((els) => els.map((el) => el.getAttribute("data-pitch-name")!));
    return { ids, names };
  }

  async function checkPlanUsesLog(page: import("@playwright/test").Page, names: string[]) {
    // The plan uses the log: A$40 an hour at the top pitch against an A$25 an hour average.
    await expect(page.getByTestId("tip-history")).toContainText("Your tip log (2 sessions, average A$25 an hour)");
    await expect(page.getByTestId("tip-history")).not.toContainText("Example data");
    const sheet = await openDetails(page, 0);
    await expect(sheet.getByTestId("tip-bonus")).toContainText("1 session here at A$40 an hour, against your A$25 an hour average");
    await page.keyboard.press("Escape");

    // The log survives a reload (the server reads its summary from the cookie, not the URL).
    await page.reload();
    await expect(page.getByTestId("tip-history")).toContainText("2 sessions");
    expect(page.url()).not.toContain("tips");

    await page.goto("/tips");
    const yours = page.getByRole("region", { name: "Sessions for Tip Tester" });
    await expect(yours.getByRole("listitem")).toHaveCount(2);
    await expect(page.getByRole("region", { name: "Bonus per pitch for Tip Tester" })).toContainText(/\+\d in your plans/);

    // Deleting asks first: Keep it leaves the session, Delete session removes it.
    const del = yours.getByRole("button", { name: new RegExp(`Delete the \\d{4}-\\d{2}-\\d{2} session at ${names[1]}`) });
    await del.click();
    const dialog = page.getByRole("dialog", { name: "Delete this session?" });
    await expect(dialog).toContainText(names[1]);
    await dialog.getByRole("button", { name: "Keep it" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(yours.getByRole("listitem")).toHaveCount(2);
    await del.click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete session" }).click();
    await expect(yours.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /Example sessions/ })).toContainText("Example data");
  }

  test("takings logged with the form on /tips adapt the plan, show in the sheet and list on the tip log", async ({ page }) => {
    await page.goto(ACT);
    await waitForPlan(page);
    await expect(page.getByTestId("tip-history")).toHaveCount(0);
    await expect(page.getByRole("form", { name: "Log your takings" })).toHaveCount(0);
    const { names } = await planPitches(page);

    // The plan links straight to the form; the plan just opened is offered as a recent plan.
    await page.getByTestId("tip-log-link").getByRole("link", { name: "Log your takings" }).click();
    await expect(page).toHaveURL(/\/tips#log-takings$/);
    const form = page.getByRole("form", { name: "Log your takings" });
    await expect(form.getByLabel("Busk")).toContainText("Tip Tester");
    for (const [index, amount] of [[0, "120"], [1, "30"]] as const) {
      await form.getByLabel("Pitch").click();
      await page.getByRole("option", { name: names[index], exact: true }).click();
      await form.getByLabel("Takings").fill(amount);
      await form.getByRole("button", { name: "Log takings" }).click();
      await expect(form.getByRole("status")).toContainText(`Logged A$${amount} at ${names[index]}`);
    }
    await expect(form.getByLabel("Takings")).toHaveValue("");

    await page.goBack();
    await page.goto(ACT);
    await waitForPlan(page);
    await checkPlanUsesLog(page, names);
  });

  test("a pitch typed on /tips is logged and listed, and says no plan can match it", async ({ page }) => {
    await page.goto("/tips");
    const form = page.getByRole("form", { name: "Log your takings" });
    await expect(form).toContainText("no plan can match it");
    await form.getByRole("button", { name: "Log takings" }).click();
    await expect(form.getByRole("alert")).toContainText("Act name");
    await form.getByLabel("Act name").fill("Typed Act");
    await form.getByLabel("Pitch").fill("Hardware Lane");
    await form.getByLabel("Takings").fill("45.5");
    await form.getByRole("button", { name: "Log takings" }).click();
    await expect(form.getByRole("status")).toContainText("Logged A$45.5 at Hardware Lane");
    const yours = page.getByRole("region", { name: "Sessions for Typed Act" });
    await expect(yours.getByRole("listitem")).toHaveCount(1);
    await expect(yours).toContainText("A$45.5");
  });

  test("takings already in this browser (seeded) adapt the plan and list on the tip log", async ({ page }) => {
    // The same result from a log seeded the way the form saves it.
    await page.goto(ACT);
    await waitForPlan(page);
    const { ids, names } = await planPitches(page);
    const today = isoDay();
    await page.evaluate(
      ([key, entries]) => localStorage.setItem(key, JSON.stringify(entries)),
      [
        "buskmap.tips.v1",
        [
          { id: "t1", performerKey: "act:tip tester", performerName: "Tip Tester", pitchId: ids[0], pitchName: names[0], date: today, startHour: 18, endHour: 21, amount: 120, example: false },
          { id: "t2", performerKey: "act:tip tester", performerName: "Tip Tester", pitchId: ids[1], pitchName: names[1], date: today, startHour: 18, endHour: 21, amount: 30, example: false },
        ],
      ] as const,
    );
    await page.reload();
    await waitForPlan(page);
    await checkPlanUsesLog(page, names);
  });

  test("an empty log says how to start", async ({ page }) => {
    await page.goto("/tips");
    await expect(page.getByText("No sessions logged in this browser yet.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Sessions for Soul and funk sax player" }).getByRole("listitem")).toHaveCount(9);
  });
});
