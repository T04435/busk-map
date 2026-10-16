import "server-only";
import { ADAPTER_NAMES, type AdapterContext, type AdapterName } from "@/server/adapters/core";
import { testSwitches } from "@/server/env";

/** Header carrying simulated outages, honoured only when fault injection is allowed (never in production). */
export const FAULTS_HEADER = "x-buskmap-faults";

export function parseFaults(value: string | null | undefined): AdapterName[] {
  if (!value) return [];
  const wanted = value.split(",").map((s) => s.trim());
  return ADAPTER_NAMES.filter((name) => wanted.includes(name));
}

/** Adapter switches for this request. */
export function adapterContextFor(faults: string | null | undefined): AdapterContext {
  const switches = testSwitches();
  return { offline: switches.offline, faults: switches.allowFaults ? parseFaults(faults) : [] };
}

export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * `faults=render` makes a page throw while rendering, to exercise error.tsx (e2e). Same gate as the
 * provider outages: only when fault injection is allowed, never in production.
 */
export function renderFaultRequested(faults: string | null | undefined): boolean {
  if (!testSwitches().allowFaults || !faults) return false;
  return faults.split(",").some((s) => s.trim() === "render");
}

/** Test fault: the fresh-run gate refuses (429), so the limit page can be tested offline. Same gate as the others. */
export const FRESH_LIMIT_FAULT = "fresh-limit";

export function freshLimitFaultRequested(faults: string | null | undefined): boolean {
  if (!testSwitches().allowFaults || !faults) return false;
  return faults.split(",").some((s) => s.trim() === FRESH_LIMIT_FAULT);
}

/**
 * The test faults a page passes on to its API calls: the provider outages plus `fresh-limit`.
 * Empty unless fault injection is allowed (never in production).
 */
export function pageFaultsFor(faults: string | null | undefined): string[] {
  if (!testSwitches().allowFaults) return [];
  return [...parseFaults(faults), ...(freshLimitFaultRequested(faults) ? [FRESH_LIMIT_FAULT] : [])];
}
