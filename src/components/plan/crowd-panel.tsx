import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ageLabel } from "@/lib/age";
import type { Plan } from "@/lib/plan-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** Where a line's evidence comes from: the Qloo call behind it. */
function Evidence({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">Evidence: {children}</p>;
}

/** A signed lean (−1…1) as a bar either side of a centre line. */
function LeanBar({ label, lean }: { label: string; lean: number }) {
  const width = `${Math.min(50, Math.round(Math.abs(lean) * 50))}%`;
  return (
    <li className="grid grid-cols-[minmax(0,7rem)_1fr_3.5rem] items-center gap-2">
      <span className="truncate">{label}</span>
      <span className="relative h-1.5 rounded-full bg-muted" aria-hidden>
        <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <span className={`absolute inset-y-0 rounded-full ${lean >= 0 ? "left-1/2 bg-foreground" : "right-1/2 bg-muted-foreground"}`} style={{ width }} />
      </span>
      <span className="text-right tabular-nums text-muted-foreground">
        {lean > 0 ? "+" : ""}
        {Math.round(lean * 100)}
      </span>
    </li>
  );
}

/**
 * Why this crowd: what central Melbourne's crowd likes given the performer's
 * taste (Qloo local artists with explainability), what drives the match, the
 * performer's fans against the usual hotspot crowd, the genres at the top
 * pitch, and the fans' age and gender lean. Every block names its Qloo source.
 */
export function CrowdPanel({ crowd, resolved, topPitch }: { crowd: Plan["crowd"]; resolved: Plan["resolvedArtists"]; topPitch: string | null }) {
  const unmatched = resolved.filter((r) => !r.matched).map((r) => r.query);
  const ages = (crowd.demographics?.age ?? []).filter((a) => a.lean > 0.05).sort((a, b) => b.lean - a.lean).slice(0, 2);
  const usualNames = new Set((crowd.usualCrowd?.artists ?? []).map((a) => a.name));
  const empty =
    crowd.localArtists.length === 0 && crowd.drivers.length === 0 && crowd.genres.length === 0 && !crowd.contrast && !crowd.demographics && !crowd.usualCrowd;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Who this crowd likes</h2>
        </CardTitle>
        <CardDescription>From Qloo&apos;s taste graph: aggregate taste around central Melbourne, never data about individuals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {empty && (
          <p className="text-muted-foreground" data-testid="crowd-empty">
            No crowd data for this plan
            {resolved.length > 0 && unmatched.length === resolved.length ? ": Qloo matched none of your artists" : ""}. The pitches still use foot
            traffic, events and weather.
          </p>
        )}

        {crowd.drivers.length > 0 && (
          <section aria-label="What drives the match" className="space-y-1">
            <h3 className="font-medium">What Qloo matched on</h3>
            <p className="text-muted-foreground">Share of the crowd&apos;s picks explained by each of your artists:</p>
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
            <Evidence>Qloo insights explainability: each artist&apos;s average effect on the crowd&apos;s top 10 picks.</Evidence>
          </section>
        )}

        {crowd.localArtists.length > 0 && (
          <section aria-label="Local artists" className="space-y-1">
            <h3 className="font-medium">Artists this crowd likes</h3>
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
                  {usualNames.has(a.name) && (
                    <Badge variant="secondary" className="ml-2">
                      Usual crowd too
                    </Badge>
                  )}
                  {a.because.length > 0 && (
                    <span className="block text-muted-foreground">
                      Because your fans like{" "}
                      {list(a.explained.length > 0 ? a.explained.map((e) => `${e.name} (${Math.round(e.score * 100)}/100)`) : a.because)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <Evidence>
              Qloo insights: artists liked in central Melbourne by fans of your artists, with each of your artists&apos; explainability score.
            </Evidence>
          </section>
        )}

        {(crowd.contrast || crowd.usualCrowd) && (
          <section aria-label="Compared with the usual crowd" className="space-y-1">
            <h3 className="font-medium">Your fans vs the usual crowd</h3>
            {crowd.usualCrowd && (
              <p className="text-muted-foreground">
                The crowd at {crowd.usualCrowd.hotspot}, with no taste signal, likes {list(crowd.usualCrowd.artists.map((a) => a.name))}.
              </p>
            )}
            {crowd.contrast && (
              <p className="text-muted-foreground">
                Compared with them
                {crowd.contrast.more.length > 0 ? `, your fans lean more towards ${list(crowd.contrast.more)}` : ""}
                {crowd.contrast.less.length > 0 ? `${crowd.contrast.more.length > 0 ? " and" : ","} less towards ${list(crowd.contrast.less)}` : ""}. That
                is why the best pitches for you are not always the famous ones.
              </p>
            )}
            <Evidence>
              Qloo insights for the hotspot&apos;s area with no performer signal
              {crowd.contrast ? "; Qloo compare: each genre's share of your artists and of theirs" : ""}.
            </Evidence>
          </section>
        )}

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
            <Evidence>Qloo taste analysis (music genres) within 400 m of the pitch, given your artists; the number is the affinity.</Evidence>
          </section>
        )}

        {crowd.demographics && (crowd.demographics.age.length > 0 || crowd.demographics.gender.length > 0) && (
          <section aria-label="Age and gender lean" className="space-y-1">
            <h3 className="font-medium">Who your fans are</h3>
            {ages.length > 0 && (
              <p className="text-muted-foreground">
                Your fans skew {list(ages.map((a) => ageLabel(a.band)))}: the {PLAYLIST_COPY.suggestedSetNoun} favours songs from their era. Pitch your banter to suit.
              </p>
            )}
            <ul className="space-y-1" aria-label="Lean by age band and gender, against the average audience">
              {crowd.demographics.age.map((a) => (
                <LeanBar key={a.band} label={ageLabel(a.band)} lean={a.lean} />
              ))}
              {crowd.demographics.gender.map((g) => (
                <LeanBar key={g.band} label={g.band[0].toUpperCase() + g.band.slice(1)} lean={g.lean} />
              ))}
            </ul>
            <Evidence>Qloo demographics for fans of your artists; + is above the average audience, − below.</Evidence>
          </section>
        )}

        {unmatched.length > 0 && <p className="text-muted-foreground">Qloo couldn&apos;t match: {unmatched.join(", ")}.</p>}
      </CardContent>
    </Card>
  );
}
