import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Chip } from "@/components/honeycomb/chip";
import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { QlooWordmark } from "@/components/honeycomb/logo";
import { EvidenceLine } from "@/components/honeycomb/evidence-line";
import { LeanBar } from "@/components/honeycomb/lean-bar";
import { MeterBar, PercentCell } from "@/components/honeycomb/percent-cell";
import { Badge } from "@/components/ui/badge";
import { ageLabel } from "@/lib/age";
import type { Plan } from "@/lib/plan-schema";

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

function Block({ title, label, evidence, children }: { title: string; label?: string; evidence: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label ?? title} className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h4 className="m-0 font-display text-[22px] leading-none font-extrabold uppercase">{title}</h4>
      {children}
      <EvidenceLine>{evidence}</EvidenceLine>
    </section>
  );
}

/**
 * Why this crowd: what central Melbourne's crowd likes given the performer's taste (Qloo local artists with explainability),
 * what drives the match, the performer's fans against the usual hotspot crowd, the genres at the top pitch, and the fans'
 * age and gender lean. Every block ends with the Qloo call behind it.
 */
export function CrowdPanel({ crowd, resolved, topPitch, qlooMode = "live" }: { crowd: Plan["crowd"]; resolved: Plan["resolvedArtists"]; topPitch: string | null; qlooMode?: Plan["qlooMode"] }) {
  const unmatched = resolved.filter((r) => !r.matched).map((r) => r.query);
  const ages = (crowd.demographics?.age ?? []).filter((a) => a.lean > 0.05).sort((a, b) => b.lean - a.lean).slice(0, 2);
  const leanMax = Math.max(0.05, ...(crowd.demographics ? [...crowd.demographics.age, ...crowd.demographics.gender].map((d) => Math.abs(d.lean)) : []));
  const usualNames = new Set((crowd.usualCrowd?.artists ?? []).map((a) => a.name));
  const empty = crowd.localArtists.length === 0 && crowd.drivers.length === 0 && crowd.genres.length === 0 && !crowd.contrast && !crowd.demographics && !crowd.usualCrowd;
  return (
    <section aria-label="Who this crowd likes" className="space-y-4 border-2 border-rule bg-card p-4 md:p-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h3 className="m-0 font-display text-[28px] leading-none font-extrabold uppercase">Who this crowd likes</h3>
          <span className="inline-flex items-center gap-2">
            <QlooWordmark width={44} />
            <DataStatusBadge status={qlooMode === "live" ? "live" : "test"} />
          </span>
        </div>
        <p className="m-0 text-sm text-muted-foreground">From Qloo&apos;s taste graph: aggregate taste around central Melbourne, never data about individuals.</p>
      </header>
      {empty && (
        <p className="m-0 text-muted-foreground" data-testid="crowd-empty">
          No crowd data for this plan
          {resolved.length > 0 && unmatched.length === resolved.length ? ": Qloo matched none of your artists" : ""}. The pitches still use foot traffic, events and weather.
        </p>
      )}

      {crowd.drivers.length > 0 && (
        <Block title="What Qloo matched on" label="What drives the match" evidence="Qloo insights explainability: each artist's average effect on the crowd's top 10 picks.">
          <p className="m-0 text-sm text-muted-foreground">Share of the crowd&apos;s picks explained by each of your artists:</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {crowd.drivers.map((d) => (
              <MeterBar key={d.name} label={d.name} value={Math.min(1, d.share)} />
            ))}
          </ul>
        </Block>
      )}

      {crowd.localArtists.length > 0 && (
        <Block title="Artists this crowd likes" label="Local artists" evidence="Qloo insights: artists liked in central Melbourne by fans of your artists, with each of your artists' explainability score.">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {crowd.localArtists.map((a) => (
              <li key={a.name} className="space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  {a.affinity !== null && <PercentCell value={a.affinity * 100} size={36} label="Affinity" />}
                  <b>{a.name}</b>
                  {a.trend !== null && a.trend >= 1 && <Badge variant="neutral">Rising +{a.trend.toFixed(1)} pts</Badge>}
                  {usualNames.has(a.name) && <Badge variant="usual">Usual crowd too</Badge>}
                </span>
                {a.because.length > 0 && (
                  <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                    Because your fans like{" "}
                    {a.explained.length > 0
                      ? a.explained.map((e, i) => (
                          <span key={e.name} className="inline-flex items-center gap-1">
                            {e.name}
                            <PercentCell value={e.score * 100} size={30} label="Explains" />
                            {i < a.explained.length - 1 ? "," : ""}
                          </span>
                        ))
                      : list(a.because)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {(crowd.contrast || crowd.usualCrowd) && (
        <Block
          title="Your fans vs the usual crowd"
          label="Compared with the usual crowd"
          evidence={`Qloo insights for the hotspot's area with no performer signal${crowd.contrast ? "; Qloo compare: each genre's share of your artists and of theirs" : ""}.`}
        >
          {crowd.usualCrowd && (
            <p className="m-0 text-muted-foreground">
              The crowd at {crowd.usualCrowd.hotspot}, with no taste signal, likes {list(crowd.usualCrowd.artists.map((a) => a.name))}.
            </p>
          )}
          {crowd.contrast && (
            <div className="space-y-2">
              {crowd.contrast.more.length > 0 && (
                <div className="space-y-1">
                  <span className="text-sm font-bold">Your fans lean more towards</span>
                  <div className="flex flex-wrap gap-2">
                    {crowd.contrast.more.map((g) => (
                      <Chip key={g} icon={<Plus />}>
                        {g}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {crowd.contrast.less.length > 0 && (
                <div className="space-y-1">
                  <span className="text-sm font-bold">Less towards</span>
                  <div className="flex flex-wrap gap-2">
                    {crowd.contrast.less.map((g) => (
                      <Chip key={g}>{g}</Chip>
                    ))}
                  </div>
                </div>
              )}
              <p className="m-0 text-sm text-muted-foreground">That is why the best pitches for you are not always the famous ones.</p>
            </div>
          )}
        </Block>
      )}

      {crowd.genres.length > 0 && (
        <Block title={`Genres around ${topPitch ?? "the top pitch"}`} label="Genres at the top pitch" evidence="Qloo taste analysis (music genres) within 400 m of the pitch, given your artists; the cell is the affinity.">
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
            {crowd.genres.map((g) => (
              <MeterBar key={g.name} label={g.name} value={g.affinity} />
            ))}
          </ul>
        </Block>
      )}

      {crowd.demographics && (crowd.demographics.age.length > 0 || crowd.demographics.gender.length > 0) && (
        <Block title="Who your fans are" label="Age and gender lean" evidence="Qloo demographics for fans of your artists; + is above the average audience, − below.">
          {ages.length > 0 && (
            <p className="m-0 text-muted-foreground">Your fans skew {list(ages.map((a) => ageLabel(a.band)))}: the setlist favours songs from their era. Pitch your banter to suit.</p>
          )}
          <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Lean by age band and gender, against the average audience">
            {crowd.demographics.age.map((a) => (
              <LeanBar key={a.band} label={ageLabel(a.band)} lean={a.lean} max={leanMax} />
            ))}
            {crowd.demographics.gender.map((g) => (
              <LeanBar key={g.band} label={g.band[0].toUpperCase() + g.band.slice(1)} lean={g.lean} max={leanMax} />
            ))}
          </ul>
        </Block>
      )}

      {unmatched.length > 0 && <p className="m-0 text-muted-foreground">Qloo couldn&apos;t match: {unmatched.join(", ")}.</p>}
    </section>
  );
}
