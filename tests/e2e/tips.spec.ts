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

  test("takings logged in this browser adapt the plan, show in the sheet and list on the tip log", async ({ page }) => {
    // The plan page no longer holds the log form (it links to the Tip log), so seed the log the way the form saves it.
    await page.goto(ACT);
    await waitForPlan(page);
    await expect(page.getByTestId("tip-history")).toHaveCount(0);
    await expect(page.getByTestId("tip-log-link")).toContainText("Tip log");
    await expect(page.getByRole("form", { name: "Log your takings" })).toHaveCount(0);
    const pitches = page.getByRole("region", { name: "Pitches", exact: true }).locator("li[data-pitch-id]");
    const ids = await pitches.evaluateAll((els) => els.map((el) => el.getAttribute("data-pitch-id")!));
    const names = await page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]").evaluateAll((els) => els.map((el) => el.getAttribute("data-pitch-name")!));
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
    await expect(page.getByRole("region", { name: "Bonus per pitch for Tip Tester" })).toContainText(/\+\d points/);
    await yours.getByRole("button", { name: new RegExp(`Delete the \\d{4}-\\d{2}-\\d{2} session at ${names[1]}`) }).click();
    await expect(yours.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /Example sessions/ })).toContainText("Example data");
  });

  test("an empty log says how to start", async ({ page }) => {
    await page.goto("/tips");
    await expect(page.getByText("No sessions logged in this browser yet.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Sessions for Soul and funk sax player" }).getByRole("listitem")).toHaveCount(9);
  });
});
