import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, LOCAL, test } from "./fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
// /busks has the artist search only: songs are added on /repertoire.
const SEARCHES = ["Search Spotify, e.g. Paul Kelly"];

test.describe("accessibility", () => {
  test("landing has no critical axe violations (B-004)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const critical = violations.filter((v) => v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(critical).toEqual([]);
  });

  for (const [name, path, ready] of [
    ["landing", "/", (p: Page) => expect(p.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible()],
    ["/busks", "/busks", (p: Page) => expect(p.getByPlaceholder(SEARCHES[0])).toBeVisible()],
    ["/brand", "/brand", (p: Page) => expect(p.getByRole("heading", { level: 1, name: /Honeycomb/ })).toBeVisible()],
    ["/terms", "/terms", (p: Page) => expect(p.getByRole("heading", { level: 1, name: /promises/i })).toBeVisible()],
    ["/privacy", "/privacy", (p: Page) => expect(p.getByRole("heading", { level: 1, name: /keeps/i })).toBeVisible()],
  ] as const) {
    for (const scheme of ["light", "dark"] as const) {
      test(`${name} has no axe violations at any impact (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await ready(page);
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      });
    }
  }

  test("the search comboboxes say whether their list is shown and point at it only while it is (B-004)", async ({ page }) => {
    test.skip(!LOCAL, "Searches the offline catalogue");
    await page.goto("/busks");
    for (const placeholder of SEARCHES) {
      const input = page.getByPlaceholder(placeholder);
      await expect(input).toHaveAttribute("role", "combobox");
      await expect(input).toHaveAttribute("aria-expanded", "false");
      await expect(input).not.toHaveAttribute("aria-controls", /./);

      // Typed before hydration, the query is lost: retry until the list opens.
      await expect(async () => {
        await input.fill("");
        await input.fill("Buena Vista");
        await expect(input).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
      }).toPass();
      const controls = await input.getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      await expect(page.locator(`[id="${controls}"]`)).toHaveAttribute("role", "listbox");

      await input.fill("");
      await expect(input).toHaveAttribute("aria-expanded", "false");
      await expect(input).not.toHaveAttribute("aria-controls", /./);
    }
  });

  test("the poster buttons keep a visible focus ring next to their offset shadow (B-018)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
    // Both sit on a dark band, so the ring is the night one: a 3px signal-orange (#ff6a2b) outline, 10px out.
    for (const cta of [page.getByRole("link", { name: "Plan a busk" }).first(), page.getByRole("link", { name: "Plan a busk" }).last()]) {
      const shadow = () => cta.evaluate((el) => getComputedStyle(el).boxShadow);
      const outline = () => cta.evaluate((el) => `${getComputedStyle(el).outlineStyle} ${getComputedStyle(el).outlineWidth} ${getComputedStyle(el).outlineColor}`);
      const before = await shadow();
      expect(before).toMatch(/6px 6px 0px/);
      expect(await outline()).toMatch(/^none/);
      await expect(async () => {
        await cta.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(cta).toBeFocused({ timeout: 500 });
      }).toPass();
      // One ring, an outline (not a second box-shadow layer), and the poster shadow stays as it was.
      await expect.poll(outline).toBe("solid 3px rgb(255, 106, 43)"); // an outline 10px out, never a ring box-shadow (polled: outline-color transitions)
      expect(await shadow()).toBe(before);
    }
  });

  // F13/F14: one border and one focus ring per field. The ring is a single 2px box-shadow layer; no global rule stacks a second.
  const visibleLayers = (shadow: string) => shadow.split(/,(?![^(]*\))/).map((s) => s.trim()).filter((s) => s !== "none" && !/rgba\(0, 0, 0, 0\)/.test(s) && (s.match(/-?[\d.]+px/g) ?? []).some((n) => parseFloat(n) !== 0));

  test("a focused InputGroup search and a focused Input each show exactly one ring (F13, F14, B-005)", async ({ page }) => {
    await page.goto("/busks");
    // The search field: the group carries the one border and the one ring; the input inside carries neither.
    for (const placeholder of SEARCHES) {
      const input = page.getByPlaceholder(placeholder);
      const group = input.locator("xpath=ancestor::*[@data-slot='input-group'][1]");
      const read = (loc: typeof group) => loc.evaluate((el) => ({ shadow: getComputedStyle(el).boxShadow, outline: getComputedStyle(el).outlineStyle, border: getComputedStyle(el).borderTopWidth }));
      expect(visibleLayers((await read(group)).shadow)).toEqual([]);
      await expect(input).toHaveAttribute("aria-expanded", "false");
      await expect(async () => {
        await input.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(input).toBeFocused({ timeout: 500 });
      }).toPass();
      await expect.poll(async () => visibleLayers((await read(group)).shadow).length).toBe(1);
      const g = await read(group);
      expect(visibleLayers(g.shadow)[0]).toMatch(/ 0px 0px 0px 2px/); // 2px ring, no gap layer
      expect(g.border).toBe("2px");
      const inner = await read(input);
      expect(visibleLayers(inner.shadow)).toEqual([]);
      expect(inner.outline).toBe("none");
      expect(inner.border).toBe("0px");
    }
    // A plain Input: its own border plus one ring.
    const name = page.getByLabel("Act name");
    await expect(async () => {
      await name.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(name).toBeFocused({ timeout: 500 });
    }).toPass();
    const field = await name.evaluate((el) => ({ shadow: getComputedStyle(el).boxShadow, outline: getComputedStyle(el).outlineStyle, border: getComputedStyle(el).borderTopWidth }));
    expect(visibleLayers(field.shadow)).toHaveLength(1);
    expect(field.shadow).toMatch(/ 0px 0px 0px 2px/);
    expect(field.outline).toBe("none");
    expect(field.border).toBe("2px");
  });
});
