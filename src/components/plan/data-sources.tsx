import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataStatus } from "@/lib/plan-schema";
import { QLOO_TEST_LABEL, SOURCES, type SourceId } from "@/lib/sources";

const MODE_LABEL: Record<DataStatus["mode"], string> = {
  live: "Live",
  synthetic: "Synthetic test data",
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

/** Every data source, its credit, licence link and how this plan used it. */
export function DataSources({ status, showAi }: { status: DataStatus[]; showAi: boolean }) {
  const used = new Map(status.map((s) => [s.source, s]));
  const ids: SourceId[] = ["qloo", "melbourne-pedestrian", "melbourne-busking", "osm", "ticketmaster", "lastfm", "open-meteo", "spotify", "openfreemap"];
  if (showAi) ids.push("ai");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Data sources</h2>
        </CardTitle>
        <CardDescription>Where every number on this page comes from.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {ids.map((id) => {
            const source = SOURCES[id];
            const s = used.get(id);
            return (
              <li key={id} className="flex flex-wrap items-center gap-2">
                <a className="underline" href={source.url} target="_blank" rel="noreferrer">
                  {source.credit}
                </a>
                <span className="text-muted-foreground">({source.licence})</span>
                {s && (
                  <Badge variant={s.mode === "fallback" ? "default" : s.mode === "synthetic" ? "secondary" : "outline"}>
                    {s.source === "qloo" && s.mode === "synthetic" ? QLOO_TEST_LABEL : MODE_LABEL[s.mode]}
                    {s.reason ? `: ${REASON_LABEL[s.reason] ?? s.reason}` : ""}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
