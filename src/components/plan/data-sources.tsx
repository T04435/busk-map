import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { SourceLogo } from "@/components/honeycomb/source-logo";
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
/** Sources a run has touched, from its tool calls. */
export function sourcesTouched(tools: (string | null)[]): SourceId[] {
  const map: Record<string, SourceId[]> = {
    taste_map: ["qloo"],
    crowd_at: ["qloo"],
    busy_places: ["qloo", "osm"],
    events_near: ["ticketmaster"],
    footfall_at: ["melbourne-pedestrian"],
    check_pitch: ["melbourne-busking"],
    build_setlist: ["spotify", "lastfm", "qloo"],
    score_pitches: ["open-meteo"],
  };
  return [...new Set(tools.flatMap((t) => (t ? (map[t] ?? []) : [])))];
}

export function statusText(s: DataStatus): string {
  return `${s.source === "qloo" && s.mode === "synthetic" ? QLOO_TEST_LABEL : MODE_LABEL[s.mode]}${s.reason ? `: ${REASON_LABEL[s.reason] ?? s.reason}` : ""}`;
}

/** What each source is used for, in the DS SourceAttribution wording. */
const USE: Record<SourceId, string> = {
  qloo: "Taste, crowds, venues and event crowds",
  "melbourne-pedestrian": "Foot traffic",
  "melbourne-busking": "Where you may play",
  osm: "Public spaces and venue names",
  ticketmaster: "Events near each pitch",
  lastfm: "Song popularity",
  "open-meteo": "The forecast for your slot",
  spotify: "Song years, lengths and popularity",
  openfreemap: "Map tiles",
  ai: "The reasons written for each pitch",
};

/** Every data source, its credit, licence link and how this plan used it (the DS SourceAttribution). */
export function DataSources({ status, showAi, soFar }: { status: DataStatus[]; showAi: boolean; /** While the run is live: only the sources it has touched so far. */ soFar?: SourceId[] }) {
  const used = new Map(status.map((s) => [s.source, s]));
  const ids: SourceId[] = ["qloo", "melbourne-pedestrian", "melbourne-busking", "osm", "ticketmaster", "lastfm", "open-meteo", "spotify", "openfreemap"];
  if (showAi) ids.push("ai");
  const shown = soFar ? ids.filter((id) => soFar.includes(id)) : ids;
  return (
    <section aria-label="Data used" data-testid="data-used">
      <h3 className="m-0 mb-1.5 font-mono text-[11px] leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase">{soFar ? "Data used so far" : "Data used"}</h3>
      <ul className="m-0 list-none p-0">
        {shown.map((id) => {
          const source = SOURCES[id];
          const s = used.get(id);
          return (
            <li key={id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-border py-2.5 text-sm leading-5 first:border-t-0">
              <div>
                <div className="flex flex-wrap items-center gap-x-2 font-bold">
                  {id === "qloo" || id === "spotify" || id === "lastfm" ? <SourceLogo source={id} height={14} /> : null}
                  <a className="underline decoration-[1.5px] underline-offset-3 hover:decoration-[2.5px]" href={source.url} target="_blank" rel="noreferrer">
                    {source.credit}
                  </a>
                </div>
                <div className="text-[13px] text-muted-foreground">
                  {USE[id]} · {source.licence}
                </div>
              </div>
              {(s || soFar) && <DataStatusBadge status={s ? s.mode : "live"} label={s ? statusText(s) : "Live"} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
