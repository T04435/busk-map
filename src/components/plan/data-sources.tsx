import type { CityLevels } from "@/lib/city";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
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
    activity_at: ["qloo"],
    check_pitch: ["melbourne-busking"],
    build_setlist: ["spotify", "lastfm", "qloo"],
    score_pitches: ["open-meteo"],
  };
  return [...new Set(tools.flatMap((t) => (t ? (map[t] ?? []) : [])))];
}

export function statusText(s: DataStatus): string {
  return `${s.source === "qloo" && s.mode === "synthetic" ? QLOO_TEST_LABEL : MODE_LABEL[s.mode]}${s.reason ? `: ${REASON_LABEL[s.reason] ?? s.reason}` : ""}`;
}

/** Every data source, its credit and licence (the DS SourceAttribution), on AI Elements Sources: always open, so every credit stays visible. */
export function DataSources({
  status,
  showAi,
  soFar,
  levels = null,
}: {
  status: DataStatus[];
  showAi: boolean;
  /** While the run is live: only the sources it has touched so far. */
  soFar?: SourceId[];
  /** The plan's city levels: a city without council rules doesn't credit Melbourne's busking layers. */
  levels?: CityLevels | null;
}) {
  const used = new Map(status.map((s) => [s.source, s]));
  const ids: SourceId[] = ["qloo", ...(levels?.rules === "none" ? [] : (["melbourne-busking"] as const)), "osm", "ticketmaster", "lastfm", "open-meteo", "spotify", "openfreemap"];
  if (showAi) ids.push("ai");
  const shown = soFar ? ids.filter((id) => soFar.includes(id)) : ids;
  return (
    <Sources defaultOpen asChild>
    <section aria-label="Data used" data-testid="data-used">
      <h3 className="m-0 mb-1.5 font-mono text-[11px] leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase">
        <SourcesTrigger count={shown.length} className="inline cursor-pointer text-left uppercase">
          {soFar ? "Data used so far" : "Data used"}
        </SourcesTrigger>
      </h3>
      <SourcesContent asChild>
      <ul className="m-0 list-none p-0">
        {shown.map((id) => {
          const source = SOURCES[id];
          const s = used.get(id);
          return (
            <Item key={id} asChild className="grid grid-cols-[1fr_auto] items-stretch gap-x-3 gap-y-0.5 border-t border-border py-2.5 text-sm leading-5 first:border-t-0">
              <li>
                <ItemContent className="block min-w-auto">
                  <ItemTitle className="flex flex-wrap items-center gap-x-2">
                    {id === "qloo" || id === "spotify" || id === "lastfm" ? <SourceLogo source={id} height={14} /> : null}
                    <Source className="inline underline decoration-[1.5px] underline-offset-3 hover:decoration-[2.5px]" href={source.url}>
                      {source.credit}
                    </Source>
                  </ItemTitle>
                  <ItemDescription asChild className="text-[13px] leading-[inherit]">
                    <div>{source.licence}</div>
                  </ItemDescription>
                </ItemContent>
                {(s || soFar) && <DataStatusBadge status={s ? s.mode : "live"} label={s ? statusText(s) : "Live"} />}
              </li>
            </Item>
          );
        })}
      </ul>
      </SourcesContent>
    </section>
    </Sources>
  );
}
