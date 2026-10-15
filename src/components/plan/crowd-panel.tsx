import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ageLabel } from "@/lib/age";
import type { Plan } from "@/lib/plan-schema";

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/**
 * What this city's crowd likes, given the performer's taste: Qloo's local
 * artists with explainability, trending, the genres at the top pitch, the
 * contrast with the usual hotspot crowd, and the age lean.
 */
export function CrowdPanel({ crowd, resolved, topPitch }: { crowd: Plan["crowd"]; resolved: Plan["resolvedArtists"]; topPitch: string | null }) {
  const unmatched = resolved.filter((r) => !r.matched).map((r) => r.query);
  const ages = (crowd.demographics?.age ?? []).filter((a) => a.lean > 0.05).sort((a, b) => b.lean - a.lean).slice(0, 2);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Who this crowd likes</h2>
        </CardTitle>
        <CardDescription>From Qloo&apos;s taste graph: aggregate taste around central Melbourne, never data about individuals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {crowd.drivers.length > 0 && (
          <section aria-label="What drives the match" className="space-y-1">
            <h3 className="font-medium">What Qloo matched on</h3>
            <p className="text-muted-foreground">Share of the crowd&apos;s picks explained by each of your artists (Qloo explainability):</p>
            <ul className="space-y-1">
              {crowd.drivers.map((d) => (
                <li key={d.name} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2">
                  <span className="truncate">{d.name}</span>
                  <span className="h-1.5 rounded-full bg-muted" aria-hidden>
                    <span className="block h-1.5 rounded-full bg-foreground" style={{ width: `${Math.min(100, Math.round(d.share * 100))}%` }} />
                  </span>
                  <span className="tabular-nums text-muted-foreground">{Math.round(d.share * 100)}%</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Local artists" className="space-y-1">
          <h3 className="font-medium">Artists this crowd likes</h3>
          {crowd.localArtists.length === 0 ? (
            <p className="text-muted-foreground">No crowd data for this plan.</p>
          ) : (
            <ul className="space-y-2">
              {crowd.localArtists.map((a) => (
                <li key={a.name}>
                  <span className="font-medium">{a.name}</span>
                  {a.affinity !== null && <span className="text-muted-foreground"> · affinity {Math.round(a.affinity * 100)}/100</span>}
                  {a.trend !== null && a.trend >= 1 && (
                    <Badge variant="outline" className="ml-2">
                      Rising +{a.trend.toFixed(1)} pts
                    </Badge>
                  )}
                  {a.because.length > 0 && <span className="block text-muted-foreground">Because your fans like {list(a.because)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {crowd.genres.length > 0 && (
          <section aria-label="Genres at the top pitch" className="space-y-1">
            <h3 className="font-medium">Genres around {topPitch ?? "the top pitch"}</h3>
            <div className="flex flex-wrap gap-1">
              {crowd.genres.map((g) => (
                <Badge key={g.name} variant="secondary">
                  {g.name}
                  {g.affinity !== null ? ` ${Math.round(g.affinity * 100)}` : ""}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {crowd.contrast && (
          <section aria-label="Compared with the usual crowd" className="space-y-1">
            <h3 className="font-medium">Not the usual crowd</h3>
            <p className="text-muted-foreground">
              Compared with the crowd at {crowd.contrast.hotspot}
              {crowd.contrast.more.length > 0 ? `, your fans lean more towards ${list(crowd.contrast.more)}` : ""}
              {crowd.contrast.less.length > 0 ? `${crowd.contrast.more.length > 0 ? " and" : ","} less towards ${list(crowd.contrast.less)}` : ""}. That is
              why the best pitches for you are not always the famous ones (Qloo compare).
            </p>
          </section>
        )}

        {ages.length > 0 && (
          <p className="text-muted-foreground">
            Your fans skew {list(ages.map((a) => ageLabel(a.band)))} (Qloo demographics): pick songs and banter to suit.
          </p>
        )}
        {unmatched.length > 0 && <p className="text-muted-foreground">Qloo couldn&apos;t match: {unmatched.join(", ")}.</p>}
      </CardContent>
    </Card>
  );
}
