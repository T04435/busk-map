/**
 * QA: Repertoire R2 (1b81087..8e4cd0d) — the edges DEV's repertoire-planners.spec.ts doesn't cover: the switch off,
 * seed and PATCH validation, Add to Repertoire's two 409s and Origin, and usual pitches (only an unedited Repertoire
 * busk counts, once per plan, at most 3). Offline server only; each test has its own cookie jar.
 */
import { expect, LOCAL, SATURDAY, test, waitForPlan } from "../fixtures";

type Page = import("@playwright/test").Page;
type Api = import("@playwright/test").APIRequestContext;

const SONGS = [
  { title: "How to Make Gravy", artist: "Paul Kelly", own: false },
  { title: "Scar", artist: "Missy Higgins", own: false },
];
const state = async (api: Api) => (await (await api.get("/api/playlist")).json()).playlist;
const seed = async (api: Api, actName = `QA ${Math.random().toString(36).slice(2, 8)}`) => {
  const res = await api.post("/api/playlist", { data: { actName, soundsLike: [{ name: "Paul Kelly" }, { name: "Missy Higgins" }], songs: SONGS } });
  expect(res.status()).toBe(201);
  return actName;
};
const form = (page: Page) => page.getByRole("form", { name: "Plan for your own act" });
const titles = (p: { songs: { title: string }[] }) => p.songs.map((s) => s.title).sort();

test.describe("QA Repertoire R2: the planners", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("switch off: the form drops the Repertoire, the plan uses what was typed, and nothing is saved or recorded", async ({ page }) => {
    await seed(page.request);
    const before = await state(page.request);
    await page.goto("/");
    const f = form(page);
    const sw = f.getByRole("switch", { name: "Use my Repertoire (2 songs)" });
    await expect(sw).toBeChecked();
    await sw.click();
    await expect(sw).not.toBeChecked();
    await expect(f.getByText("From your Repertoire")).toHaveCount(0);
    await expect(f.getByRole("list", { name: "Songs you picked" })).toHaveCount(0);
    // Back on restores it whole; off again for a typed act.
    await sw.click();
    await expect(f.getByRole("list", { name: "Songs you picked" }).getByRole("listitem")).toHaveCount(2);
    await sw.click();

    await f.getByLabel("Act name").fill("QA Typed Act");
    await f.getByPlaceholder("Search Spotify, e.g. Paul Kelly").fill("Paul Kelly");
    await page.getByRole("option", { name: /Paul Kelly/ }).first().click();
    const posted = page.waitForRequest((r) => r.url().endsWith("/api/plans") && r.method() === "POST");
    await f.getByRole("button", { name: "Plan my set" }).click();
    const body = (await posted).postDataJSON();
    expect(body.performer.name).toBe("QA Typed Act");
    expect(body.performer.songs ?? []).toEqual([]);
    await waitForPlan(page);

    const after = await state(page.request);
    expect(after.revision).toBe(before.revision);
    expect(titles(after)).toEqual(titles(before));
    expect(after.usualPitches).toEqual([]);
  });

  test("usual pitches: an unedited Repertoire busk records its top pitch once per plan, never more than 3", async ({ request }) => {
    const actName = await seed(request);
    const performer = { name: actName, artists: ["Paul Kelly", "Missy Higgins"], songs: SONGS };
    const plan = async (startHour: number) => {
      const res = await request.post("/api/plan", { data: { city: "melbourne", slot: { date: SATURDAY, startHour, endHour: startHour + 3 }, performer } });
      expect(res.status()).toBe(200);
      return (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((e) => e.type === "plan")?.plan;
    };
    const first = await plan(10);
    await expect.poll(async () => (await state(request)).usualPitches.map((p: { name: string }) => p.name)).toEqual([first.pitches[0].name]);
    // The same plan again (a replay of the same request) is not a second busk.
    await plan(10);
    expect((await state(request)).usualPitches).toHaveLength(1);
    for (const h of [12, 14, 16, 18]) await plan(h);
    const usual = (await state(request)).usualPitches;
    expect(usual.length).toBeGreaterThanOrEqual(1);
    expect(usual.length).toBeLessThanOrEqual(3);
    // Bookkeeping only: the revision didn't move.
    expect((await state(request)).revision).toBe(1 + 1); // created at 1, the seed's update made it 2
  });

  test("an edited request (one song changed) records no usual pitch", async ({ request }) => {
    const actName = await seed(request);
    const res = await request.post("/api/plan", {
      data: { city: "melbourne", slot: { date: SATURDAY, startHour: 18, endHour: 21 }, performer: { name: actName, artists: ["Paul Kelly"], songs: [SONGS[0]] } },
    });
    await res.text();
    expect((await state(request)).usualPitches).toEqual([]);
  });
});

test.describe("QA Repertoire R2: API edges", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("a seed never overwrites an existing Repertoire; duplicates collapse; over 60 is 400", async ({ request }) => {
    const dup = await request.post("/api/playlist", { data: { songs: [SONGS[0], { ...SONGS[0], title: "how to make gravy!" }, SONGS[1]] } });
    expect(dup.status()).toBe(201);
    expect(titles(await state(request))).toEqual(["How to Make Gravy", "Scar"]);
    const again = await request.post("/api/playlist", { data: { actName: "Overwrite?", songs: [{ title: "Other", artist: "Someone", own: false }] } });
    expect(again.status()).toBe(200);
    const kept = await state(request);
    expect(titles(kept)).toEqual(["How to Make Gravy", "Scar"]);
    expect(kept.actName).not.toBe("Overwrite?");

    const many = Array.from({ length: 61 }, (_, i) => ({ title: `Song ${i}`, artist: `Artist ${i}`, own: false }));
    expect((await request.patch("/api/playlist", { data: { revision: kept.revision, songs: many } })).status()).toBe(400);
    expect(titles(await state(request))).toEqual(["How to Make Gravy", "Scar"]);
  });

  test("PATCH songs keeps Learned songs that stay, and their state", async ({ request }) => {
    await seed(request);
    const s0 = await state(request);
    const gravy = s0.songs.find((s: { title: string }) => s.title === "How to Make Gravy");
    expect((await request.patch(`/api/playlist/songs/${gravy.id}`, { data: { state: "learned" } })).ok()).toBe(true);
    const s1 = await state(request);
    const res = await request.patch("/api/playlist", { data: { revision: s1.revision, songs: [...SONGS, { title: "Riptide", artist: "Vance Joy", own: false }] } });
    expect(res.status()).toBe(200);
    const s2 = await state(request);
    expect(s2.songs.find((s: { title: string }) => s.title === "How to Make Gravy")).toMatchObject({ id: gravy.id, state: "learned" });
    expect(titles(s2)).toEqual(["How to Make Gravy", "Riptide", "Scar"]);
  });

  test("Add to Repertoire: 201, then 409 already_suggested (any case), 409 in_repertoire for a song you sing, 403 cross-site", async ({ request }) => {
    await seed(request);
    const add = (title: string, artist: string, headers?: Record<string, string>) =>
      request.post("/api/playlist/learn/suggestions", { data: { title, artist, reason: "Rising with this crowd" }, headers });
    expect((await add("Riptide", "Vance Joy")).status()).toBe(201);
    for (const [t, a] of [["Riptide", "Vance Joy"], ["riptide!", "VANCE JOY"]]) {
      const res = await add(t, a);
      expect(res.status()).toBe(409);
      expect((await res.json()).error.code).toBe("already_suggested");
    }
    const sing = await add("Scar", "Missy Higgins");
    expect(sing.status()).toBe(409);
    expect((await sing.json()).error.code).toBe("in_repertoire");
    const evil = await add("Holocene", "Bon Iver", { origin: "https://evil.example" });
    expect(evil.status()).toBe(403);
    expect((await add("Holocene", "Bon Iver")).status()).toBe(201);
    // Suggestions aren't songs you can sing: the Repertoire's songs are unchanged.
    expect(titles(await state(request))).toEqual(["How to Make Gravy", "Scar"]);
  });
});

test.describe("QA Repertoire R2: axe on the new states", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");
  const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

  test("form with a Repertoire (and edited), week with its switch, plan offering Save these songs: 0 violations", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    const scan = async (what: string) => {
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.impact} ${v.id}`), what).toEqual([]);
    };
    // No Repertoire yet: a typed busk's plan offers to save its songs.
    await page.goto("/");
    const f = form(page);
    await f.getByLabel("Act name").fill("QA Save Offer");
    await f.getByPlaceholder("Search Spotify, e.g. Paul Kelly").fill("Paul Kelly");
    await page.getByRole("option", { name: /Paul Kelly/ }).first().click();
    await f.getByPlaceholder(/One per line/).fill("How to Make Gravy - Paul Kelly");
    await f.getByRole("button", { name: "Plan my set" }).click();
    await waitForPlan(page);
    await expect(page.getByTestId("save-as-repertoire")).toBeVisible();
    await scan("plan with Save these songs");

    await seed(page.request);
    await page.goto("/");
    await expect(form(page).getByText("From your Repertoire")).toBeVisible();
    await scan("form with a Repertoire");
    await form(page).getByRole("button", { name: "Remove Scar" }).click();
    await expect(form(page).getByText("Edited for this busk")).toBeVisible();
    await scan("form edited for this busk");
    await page.goto("/week?example=sax");
    // Loaded state: the loading skeleton has its own known issue (B-017).
    await expect(page.getByRole("list", { name: "Top sessions" })).toBeVisible();
    await scan("week with its switch");
  });
});
