/**
 * The e2e server's frozen clock (BUSKMAP_FAKE_NOW, honoured only with BUSKMAP_ALLOW_FAULTS; see src/server/clock.ts):
 * Wednesday noon in Melbourne. Default dates, "slot passed" and the date pickers' minimum follow it, so the suite gives the
 * same answers at any time of day. Specs that depend on the SERVER's today must derive it from here, not from `new Date()`.
 * QA's specs can adopt it the same way.
 */
export const FAKE_NOW = process.env.BUSKMAP_FAKE_NOW ?? "2026-10-14T12:00:00+11:00";
/** The Melbourne date of FAKE_NOW. */
export const SERVER_TODAY = "2026-10-14";
/** The next Friday and Saturday slots from FAKE_NOW: where the examples open (Friday 5-8 pm sax, Saturday 6-9 pm acoustic). */
export const EXAMPLE_FRIDAY = "2026-10-16";
export const EXAMPLE_SATURDAY = "2026-10-17";

/** Whether the server runs on the frozen clock (not on a deploy, and not when BUSKMAP_FAKE_NOW is set empty). */
const FROZEN = !process.env.PLAYWRIGHT_BASE_URL && FAKE_NOW !== "";

/** YYYY-MM-DD, `days` from the server's today: the frozen one, or the real local date when the clock is not frozen. */
export function serverDay(days = 0): string {
  if (FROZEN) return new Date(Date.parse(`${SERVER_TODAY}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days).toLocaleDateString("en-CA");
}
