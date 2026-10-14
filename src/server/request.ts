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
