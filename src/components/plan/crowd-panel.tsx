import type { ReactNode } from "react";
import { Chip } from "@/components/honeycomb/chip";
import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { EvidenceLine } from "@/components/honeycomb/evidence-line";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { LeanBar } from "@/components/honeycomb/lean-bar";
import { QlooWordmark } from "@/components/honeycomb/logo";
import { MeterBar, PercentCell } from "@/components/honeycomb/percent-cell";
import { Badge } from "@/components/ui/badge";
import { ageLabel } from "@/lib/age";
import type { Plan } from "@/lib/plan-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** A block: a condensed-caps heading, its content, and the Qloo call behind it (the DS CrowdBlock). */
function Block({ title, label, evidence, children }: { title: string; label?: string; evidence: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label ?? title} className="grid gap-2 border-t border-border py-4 first-of-type:border-t-0 first-of-type:pt-0">
      <h4 className="m-0 font-display text-[17px] leading-5 font-extrabold uppercase">{title}</h4>
      {children}
      <EvidenceLine>{evidence}</EvidenceLine>
    </section>
  );
}

const Hint = ({ children }: { children: ReactNode }) => <p className="m-0 text-sm leading-5 text-muted-foreground">{children}</p>;
const Why = ({ children }: { children: ReactNode }) => <p className="m-0 mt-0.5 text-sm leading-5 text-muted-foreground">{children}</p>;
const Caption = ({ children }: { children: ReactNode }) => <span className="mb-1 block font-mono text-[11px] leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase">{children}</span>;
const meters = "m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0";

/**
 * Why this crowd: what the crowd around the plan area likes given the performer's taste (Qloo local artists with explainability),
 * what drives the match, the performer's fans against the usual hotspot crowd, the genres at the top pitch, and the fans'
 * age and gender lean. Every block ends with the Qloo call behind it. Ported from the DS CrowdPanel.
 */
export function CrowdPanel({ crowd, resolved, topPitch, qlooMode = "live" }: { crowd: Plan["crowd"]; resolved: Plan["resolvedArtists"]; topPitch: string | null; qlooMode?: Plan["qlooMode"] }) {
  const unmatched = resolved.filter((r) => !r.matched).map((r) => r.query);
  const ages = (crowd.demographics?.age ?? []).filter((a) => a.lean > 0.05).sort((a, b) => b.lean - a.lean).slice(0, 2);
  const leanMax = Math.max(0.05, ...(crowd.demographics ? [...crowd.demographics.age, ...crowd.demographics.gender].map((d) => Math.abs(d.lean)) : []));
  const usualNames = new Set((crowd.usualCrowd?.artists ?? []).map((a) => a.name));
  const empty = crowd.localArtists.length === 0 && crowd.drivers.length === 0 && crowd.genres.length === 0 && !crowd.contrast && !crowd.demographics && !crowd.usualCrowd && !crowd.localScene;
  return (
    <section aria-label="Who this crowd likes" className="border-2 border-rule bg-card p-4 md:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 font-display text-2xl leading-[26px] font-extrabold tracking-[0.01em] uppercase">Who this crowd likes</h3>
          <p className="m-0 mt-0.5 text-sm leading-5 text-muted-foreground">From Qloo&apos;s taste graph: aggregate taste around your pitches, never data about individuals.</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2">
          <QlooWordmark width={44} />
          <DataStatusBadge status={qlooMode === "live" ? "live" : "test"} />
        </span>
      </header>
      {empty && (
        <div role="status" data-testid="crowd-empty" className="grid justify-items-center gap-3 px-4 py-8 text-center">
          <HexCell size={64} lift>
            <Icon name="users" size={28} />
          </HexCell>
          <h4 className="m-0 font-display text-xl leading-[26px] font-extrabold tracking-[0.01em] uppercase">No crowd data for this plan</h4>
          <p className="m-0 max-w-[36ch] text-[15px] leading-[22px] text-muted-foreground">
            {resolved.length > 0 && unmatched.length === resolved.length ? "Qloo matched none of your artists. " : ""}The pitches still use foot traffic, events and weather.
          </p>
        </div>
      )}

      {crowd.drivers.length > 0 && (
        <Block title="What Qloo matched on" label="What drives the match" evidence="Qloo insights explainability: each of your artists' average effect on the crowd's top 10 picks.">
          <Hint>Share of the crowd&apos;s picks explained by each of your artists</Hint>
          <ul className={meters}>
            {crowd.drivers.map((d) => (
              <MeterBar key={d.name} label={d.name} value={Math.min(1, d.share)} />
            ))}
          </ul>
        </Block>
      )}

      {crowd.localArtists.length > 0 && (
        <Block title="Artists this crowd likes" label="Local artists" evidence="Qloo insights: artists liked around the plan area by fans of your artists, with each of your artists' explainability score.">
          <ul className="m-0 grid list-none gap-2 p-0">
            {crowd.localArtists.map((a) => (
              <li key={a.name}>
                <div className="flex flex-wrap items-center gap-2">
                  {a.affinity !== null && <PercentCell value={a.affinity * 100} size={34} label="Affinity" />}
                  <b>{a.name}</b>
                  {a.trend !== null && a.trend >= 1 && (
                    <Badge variant="neutral">
                      <Icon name="trending" size={14} />
                      Rising +{a.trend.toFixed(1)}
                    </Badge>
                  )}
                  {usualNames.has(a.name) && (
                    <Badge variant="usual">
                      <Icon name="usual" size={14} />
                      Usual crowd too
                    </Badge>
                  )}
                </div>
                {a.because.length > 0 && <Why>Because your fans like {a.explained.length > 0 ? list(a.explained.map((e) => `${e.name} (${Math.round(e.score * 100)})`)) : list(a.because)}</Why>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {crowd.localScene && crowd.localScene.acts.length > 0 && (
        <Block
          title="Local scene"
          label="Local scene"
          evidence="Qloo compare: the genres this city's usual crowd leans to more than global pop; Qloo insights: artists of those genres liked in the plan area, scored for fans of your artists."
        >
          <p data-testid="local-scene" className="m-0 text-[15px] leading-[22px]">
            Local scene: {list(crowd.localScene.genres.map((g) => g.name))}: acts your fans would like: {list(crowd.localScene.acts.map((a) => a.name))}.
          </p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {crowd.localScene.acts.map((a) => (
              <li key={a.name} className="flex flex-wrap items-center gap-2">
                {a.affinity !== null && <PercentCell value={a.affinity * 100} size={34} label="Affinity" />}
                <b>{a.name}</b>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {(crowd.contrast || crowd.usualCrowd) && (
        <Block
          title="Your fans vs the usual crowd"
          label="Compared with the usual crowd"
          evidence={`Qloo insights for the hotspot's area with no performer signal${crowd.contrast ? "; Qloo compare: each genre's share of your artists and of theirs." : "."}`}
        >
          {crowd.usualCrowd && <Why>The crowd at {crowd.usualCrowd.hotspot}, with no taste signal, likes {list(crowd.usualCrowd.artists.map((a) => a.name))}.</Why>}
          {crowd.contrast && (
            <div className="grid gap-2">
              {crowd.contrast.more.length > 0 && (
                <div>
                  <Caption>Your fans lean more to</Caption>
                  <div className="flex flex-wrap gap-2">
                    {crowd.contrast.more.map((g) => (
                      <Chip key={g} icon={<Icon name="plus" size={16} />}>
                        {g}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {crowd.contrast.less.length > 0 && (
                <div>
                  <Caption>Less to</Caption>
                  <div className="flex flex-wrap gap-2">
                    {crowd.contrast.less.map((g) => (
                      <Chip key={g}>{g}</Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <Hint>That&apos;s why the best pitches for you aren&apos;t always the famous ones.</Hint>
        </Block>
      )}

      {crowd.genres.length > 0 && (
        <Block title={`Genres around ${topPitch ?? "the top pitch"}`} label="Genres at the top pitch" evidence="Qloo taste analysis (music genres) within 400 m of the pitch, given your artists; the number is the affinity.">
          <ul className={meters}>
            {crowd.genres.map((g) => (
              <MeterBar key={g.name} label={g.name} value={g.affinity} />
            ))}
          </ul>
        </Block>
      )}

      {crowd.demographics && (crowd.demographics.age.length > 0 || crowd.demographics.gender.length > 0) && (
        <Block title="Who your fans are" label="Age and gender lean" evidence="Qloo demographics for fans of your artists; + is above the average audience, − below.">
          {ages.length > 0 && <Why>Your fans skew {list(ages.map((a) => ageLabel(a.band)))}: the {PLAYLIST_COPY.suggestedSetNoun} favours songs from their era. Pitch your banter to suit.</Why>}
          <ul className="m-0 grid list-none gap-1.5 p-0" aria-label="Lean by age band and gender, against the average audience">
            {crowd.demographics.age.map((a) => (
              <LeanBar key={a.band} label={ageLabel(a.band)} lean={a.lean} max={leanMax} />
            ))}
            {crowd.demographics.gender.map((g) => (
              <LeanBar key={g.band} label={g.band[0].toUpperCase() + g.band.slice(1)} lean={g.lean} max={leanMax} />
            ))}
          </ul>
        </Block>
      )}

      {unmatched.length > 0 && !empty && <p className="m-0 mt-2 text-sm leading-5 text-muted-foreground">Qloo couldn&apos;t match: {unmatched.join(", ")}.</p>}
    </section>
  );
}
