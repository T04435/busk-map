import { expect, test } from "@playwright/test";
import { FAKE_NOW } from "../clock";

/**
 * QA: default dates follow the server clock (R5). Run under any frozen instant; QA runs it at least at
 *   BUSKMAP_FAKE_NOW=2026-10-16T21:30:00+11:00  (Friday, after the sax example's 5-8 pm slot ended)
 *   BUSKMAP_FAKE_NOW=2026-10-17T00:15:00+11:00  (just after midnight, Saturday)
 * and at DEV's default (Wednesday noon). Expectations are worked out here from the spec ("the next slot that hasn't
 * ended, in the city's time zone"), not from src/lib/slot.ts.
 */
const TZ = "Australia/Melbourne";
const EXAMPLES = [
  { id: "acoustic", weekday: 6, start: 18, end: 21 },
  { id: "sax", weekday: 5, start: 17, end: 20 },
  { id: "folk-duo", weekday: 0, start: 12, end: 15 },
];

function cityNow(instant: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  return { today: `${parts.year}-${parts.month}-${parts.day}`, hours: Number(parts.hour) + Number(parts.minute) / 60 };
}
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The first date on `weekday` whose slot has not ended at the frozen instant. */
function expectedDate(weekday: number, end: number) {
  const { today, hours } = cityNow(FAKE_NOW);
  for (let k = 0; k <= 7; k++) {
    const date = addDays(today, k);
    if (weekdayOf(date) === weekday && k * 24 + end > hours) return date;
  }
  throw new Error("no date");
}

/** The plan's eyebrow day, as the app shows it (F20: no city): "Sat 17 Oct". */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = (date: string) => `${DAYS[weekdayOf(date)]} ${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
const eyebrow = (date: string) => new RegExp(`${shortDay(date)} · `, "i");

/** Any time (S1): a 3-hour window inside 10 am–10 pm, so today while one can still start (before 7 pm), else tomorrow. */
function expectedAnyTimeDate() {
  const { today, hours } = cityNow(FAKE_NOW);
  return Math.floor(hours) < 19 ? today : addDays(today, 1);
}

test.describe(`QA clock: defaults at ${FAKE_NOW}`, () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL || FAKE_NOW === "", "needs the frozen server clock");

  for (const ex of EXAMPLES) {
    test(`example ${ex.id} opens the next slot that hasn't ended, never a passed one`, async ({ page }) => {
      const date = expectedDate(ex.weekday, ex.end);
      await page.goto(`/plan?example=${ex.id}`);
      await expect(page).toHaveURL(/\/p\/[\w-]+/);
      await expect(page.getByText(eyebrow(date)).first()).toBeVisible();
      await expect(page.getByText("This slot has passed")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Pitches", exact: true })).toBeVisible();
    });
  }

  test("the busk form defaults to Any time, on today while a window can still start, else tomorrow", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await expect(form.getByRole("radio", { name: /Any time/i })).toBeChecked();
    // The DatePicker is a button (#date) that carries its ISO value in data-date.
    await expect(form.locator("#date")).toHaveAttribute("data-date", expectedAnyTimeDate());
  });

  test("?again=<id> pre-fills the next same-weekday slot that hasn't ended; the stored plan keeps its date", async ({ page }) => {
    const past = addDays(cityNow(FAKE_NOW).today, -2);
    const weekday = weekdayOf(past);
    await page.goto(`/plan?example=sax&date=${past}`);
    await expect(page).toHaveURL(/\/p\/[\w-]+/);
    const id = new URL(page.url()).pathname.split("/").pop();
    // An explicit date is kept as given, so a past one shows the passed state with its own date.
    await expect(page.getByText("This slot has passed")).toBeVisible();
    await expect(page.getByText(eyebrow(past)).first()).toBeVisible();
    await page.goto(`/busks?again=${id}`);
    await expect(page.locator("#date")).toHaveAttribute("data-date", expectedDate(weekday, 20));
  });
});
