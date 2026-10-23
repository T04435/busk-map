import "server-only";
import type { LearnLimitScope } from "@/lib/learn-schema";
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

/** Test fault: the plan run ends as if today's Qloo budget were spent, so the budget page can be tested offline. Same gate as the others. */
export const QLOO_BUDGET_FAULT = "qloo-budget";

export function qlooBudgetFaultRequested(faults: string | null | undefined): boolean {
  if (!testSwitches().allowFaults || !faults) return false;
  return faults.split(",").some((s) => s.trim() === QLOO_BUDGET_FAULT);
}

/**
 * Test faults: the learn-run gate refuses (429), as the Repertoire's own limit (`learn-limit`) or the network's
 * (`learn-limit-ip`), so both limit pages can be tested offline. Same gate as the others.
 */
export const LEARN_LIMIT_FAULT = "learn-limit";
export const LEARN_LIMIT_IP_FAULT = "learn-limit-ip";

export function learnLimitFaultRequested(faults: string | null | undefined): LearnLimitScope | null {
  if (!testSwitches().allowFaults || !faults) return null;
  const list = faults.split(",").map((s) => s.trim());
  return list.includes(LEARN_LIMIT_FAULT) ? "repertoire" : list.includes(LEARN_LIMIT_IP_FAULT) ? "ip" : null;
}

/**
 * Test fault `research-slow`: a Repertoire research run waits this long at the start of every step, so a test can look at the
 * running state (the Hive heading, the live feed) before the offline run, which is otherwise over in a blink, finishes.
 * Same gate as the others: never honoured unless fault injection is allowed.
 */
export const RESEARCH_SLOW_FAULT = "research-slow";
export const RESEARCH_SLOW_STEP_MS = 600;

export function researchStepDelayMs(faults: string | null | undefined): number {
  if (!testSwitches().allowFaults || !faults) return 0;
  return faults.split(",").some((s) => s.trim() === RESEARCH_SLOW_FAULT) ? RESEARCH_SLOW_STEP_MS : 0;
}

/**
 * Test fault `research-cut`: a Repertoire research run stops right after step 2 ("Your songs") starts, as if the function were
 * stopped mid-step: the stream ends with no `end` and the run row stays `running` (until the stale sweep). Lets a test look at
 * the page's stopped state (the step cut, the Stopped tag, Try again). Same gate as the others.
 */
export const RESEARCH_CUT_FAULT = "research-cut";

export function researchCutRequested(faults: string | null | undefined): boolean {
  if (!testSwitches().allowFaults || !faults) return false;
  return faults.split(",").some((s) => s.trim() === RESEARCH_CUT_FAULT);
}

/**
 * The test faults a page passes on to its API calls: the provider outages plus `fresh-limit`.
 * Empty unless fault injection is allowed (never in production).
 */
export function pageFaultsFor(faults: string | null | undefined): string[] {
  if (!testSwitches().allowFaults) return [];
  const learn = learnLimitFaultRequested(faults);
  return [...parseFaults(faults), ...(freshLimitFaultRequested(faults) ? [FRESH_LIMIT_FAULT] : []), ...(qlooBudgetFaultRequested(faults) ? [QLOO_BUDGET_FAULT] : []), ...(learn ? [learn === "ip" ? LEARN_LIMIT_IP_FAULT : LEARN_LIMIT_FAULT] : [])];
}
