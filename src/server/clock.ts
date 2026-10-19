import { localNow, localToday } from "@/lib/slot";
import { env, testSwitches } from "@/server/env";

/**
 * The server's clock. Always the real time, except under the test switch BUSKMAP_FAKE_NOW (an ISO instant such as
 * 2026-10-14T12:00:00+11:00), honoured only when fault injection is allowed (BUSKMAP_ALLOW_FAULTS, never in production).
 * It freezes "today" and "the hour" for dates, default slots and the slot-passed check, so e2e runs the same at any
 * time of day.
 */
export function serverNow(): Date {
  const fake = env().BUSKMAP_FAKE_NOW;
  if (fake && testSwitches().allowFaults) {
    const at = new Date(fake);
    if (!Number.isNaN(at.getTime())) return at;
  }
  return new Date();
}

export function serverToday(timeZone: string): string {
  return localToday(timeZone, serverNow());
}

export function serverLocalNow(timeZone: string) {
  return localNow(timeZone, serverNow());
}
