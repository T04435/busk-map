import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import type { DataStatus } from "@/lib/plan-schema";
import { QLOO_TEST_LABEL, SOURCES, type SourceId } from "@/lib/sources";

const MODE_LABEL: Record<DataStatus["mode"], string> = {
  live: "Live",
  synthetic: "Test data",
  fallback: "Unavailable",
};

const REASON_LABEL: Record<string, string> = {
  missing_key: "not configured",
  timeout: "timed out",
  http: "provider error",
  rate_limited: "rate limited",
  invalid_response: "unexpected response",
  not_found: "no data for this slot",
  network: "unreachable",
  fault_injected: "simulated outage (test)",
};

/** "Unavailable: timed out", "Test data", "Qloo test data (local mock)": how a source's status reads. */
export function statusText(s: DataStatus): string {
  return `${s.source === "qloo" && s.mode === "synthetic" ? QLOO_TEST_LABEL : MODE_LABEL[s.mode]}${s.reason ? `: ${REASON_LABEL[s.reason] ?? s.reason}` : ""}`;
}

/** Every data source, its credit, licence link and how this plan used it. */
export function DataSources({ status, showAi }: { status: DataStatus[]; showAi: boolean }) {
  const used = new Map(status.map((s) => [s.source, s]));
  const ids: SourceId[] = ["qloo", "melbourne-pedestrian", "melbourne-busking", "osm", "ticketmaster", "lastfm", "open-meteo", "spotify", "openfreemap"];
  if (showAi) ids.push("ai");
  return (
    <section aria-label="Data used" data-testid="data-used" className="space-y-3 border-t-2 border-rule pt-4">
      <div>
        <h3 className="m-0 font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Data used</h3>
        <p className="m-0 text-sm text-muted-foreground">Where every number on this page comes from.</p>
      </div>
      <ul className="m-0 grid list-none gap-3 p-0 text-sm md:grid-cols-2">
        {ids.map((id) => {
          const source = SOURCES[id];
          const s = used.get(id);
          return (
            <li key={id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border border-border bg-card px-3 py-2">
              <span>
                <a className="font-bold underline underline-offset-3 hover:decoration-2" href={source.url} target="_blank" rel="noreferrer">
                  {source.credit}
                </a>{" "}
                <span className="text-muted-foreground">({source.licence})</span>
              </span>
              {s && (
                <DataStatusBadge status={s.mode} label={statusText(s)} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
