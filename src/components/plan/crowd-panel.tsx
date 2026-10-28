import type { ReactNode } from "react";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import { ArtistChip } from "@/components/honeycomb/artist-chip";
import { Chip } from "@/components/honeycomb/chip";
import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { LeanBar } from "@/components/honeycomb/lean-bar";
import { MeterBar } from "@/components/honeycomb/score-cell";
import { InfoTag, NotOnQTag } from "@/components/honeycomb/info-tag";
import { Reason } from "@/components/honeycomb/reason";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import { ageLabel } from "@/lib/age";
import { SPOTIFY_ARTIST_URL } from "@/lib/mention";
import type { Plan } from "@/lib/plan-schema";

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** A block: a condensed-caps heading and its content (the DS CrowdBlock). */
function Block({ title, label, children }: { title: string; label?: string; children: ReactNode }) {
  return (
    <section aria-label={label ?? title} className="grid gap-2 border-t border-border py-4 first-of-type:border-t-0 first-of-type:pt-0">
      <h4 className="m-0 font-display text-[17px] leading-5 font-extrabold uppercase">{title}</h4>
      {children}
    </section>
  );
}

const Why = ({ children }: { children: ReactNode }) => <p className="m-0 mt-0.5 text-sm leading-5 text-muted-foreground">{children}</p>;
const Caption = ({ children }: { children: ReactNode }) => <span className="mb-1 block font-mono text-[11px] leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase">{children}</span>;
const meters = "m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0";

/**
 * Why this crowd: what the crowd around the plan area likes given the performer's taste (Qloo local artists with explainability),
 * what drives the match, the performer's fans against the usual hotspot crowd, the genres at the top pitch, and the fans'
 * age and gender lean. Ported from the DS CrowdPanel.
 */
const FROM_YOUR_MUSIC = "from your music";

/** The strongest above-average age band, labelled ("25–29"), or null when none leans. */
const topAge = (d: { band: string; lean: number }[] | undefined) => {
  const top = [...(d ?? [])].sort((a, b) => b.lean - a.lean)[0];
  return top && top.lean > 0.05 ? ageLabel(top.band) : null;
};

export function CrowdPanel({
  crowd,
  resolved,
  topPitch,
  qlooMode = "live",
  ownArtist,
}: {
  crowd: Plan["crowd"];
  resolved: Plan["resolvedArtists"];
  topPitch: string | null;
  qlooMode?: Plan["qlooMode"];
  /** The act's own artist (plan.ownArtist): marks what came "from your music" and compares your fans with this crowd. */
  ownArtist?: Plan["ownArtist"];
}) {
  const ownName = ownArtist?.used ? ownArtist.name : null;
  const fans = ownArtist?.fans ?? null;
  const fansTop = topAge(fans?.age);
  const crowdTop = topAge(crowd.demographics?.age);
  const fansMax = Math.max(0.05, ...(fans ? [...fans.age, ...fans.gender].map((d) => Math.abs(d.lean)) : []));
  const unmatched = resolved.filter((r) => !r.matched).map((r) => r.query);
  const leanMax = Math.max(0.05, ...(crowd.demographics ? [...crowd.demographics.age, ...crowd.demographics.gender].map((d) => Math.abs(d.lean)) : []));
  const usualNames = new Set((crowd.usualCrowd?.artists ?? []).map((a) => a.name));
  const empty = crowd.localArtists.length === 0 && crowd.drivers.length === 0 && crowd.genres.length === 0 && !crowd.contrast && !crowd.demographics && !fans && !crowd.usualCrowd && !crowd.localScene;
  return (
    <section aria-label="Who this crowd likes" className="border-2 border-rule bg-card p-4 md:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <h3 className="m-0 min-w-0 font-display text-2xl leading-[26px] font-extrabold tracking-[0.01em] uppercase">Who this crowd likes</h3>
        <span className="inline-flex shrink-0 items-center gap-2">
          <SourceLogo source="qloo" height={16} />
          <DataStatusBadge status={qlooMode === "live" ? "live" : "test"} />
        </span>
      </header>
      {crowd.via ? <NotOnQTag standIns={crowd.via.standIns} className="mb-4" /> : null}
      {empty && (
        <Empty role="status" data-testid="crowd-empty">
          <EmptyMedia>
            <HexCell size={64} lift>
              <Icon name="users" size={28} />
            </HexCell>
          </EmptyMedia>
          <EmptyTitle>
            <h4 className="m-0 font-display text-xl leading-[26px] font-extrabold tracking-[0.01em] uppercase">No crowd data for this plan</h4>
          </EmptyTitle>
          <EmptyDescription>
            {resolved.length > 0 && unmatched.length === resolved.length ? "Qloo matched none of your artists, so the pitches are ranked on events and weather." : "The pitches are ranked on events and weather only."}
          </EmptyDescription>
        </Empty>
      )}

      {crowd.drivers.length > 0 && (
        <Block title="What Qloo matched on" label="What drives the match">
          {ownName && ownArtist?.share != null && ownArtist.share > 0 && (
            <p data-testid="from-your-music" className="m-0 text-sm leading-5">
              <b>{ownName}</b> explains {Math.round(ownArtist.share * 100)}% of this crowd&apos;s picks: {FROM_YOUR_MUSIC}.
            </p>
          )}
          <ul className="m-0 grid list-none gap-2 p-0">
            {crowd.drivers.map((d) => (
              <li key={d.name}>
                <ArtistChip
                  name={d.name}
                  info={d.name === ownName ? <InfoTag>{FROM_YOUR_MUSIC}</InfoTag> : undefined}
                  score={<ScoreCell value={Math.round(Math.min(1, d.share) * 100)} size="sm" label="Share of picks" />}
                />
              </li>
            ))}
          </ul>
        </Block>
      )}

      {crowd.localArtists.length > 0 && (
        <Block title="Artists this crowd likes" label="Local artists">
          <ul className="m-0 grid list-none gap-2 p-0">
            {crowd.localArtists.map((a) => (
              <li key={a.name}>
                <ArtistChip
                  name={a.name}
                  image={a.image ?? undefined}
                  href={a.spotifyId ? SPOTIFY_ARTIST_URL(a.spotifyId) : undefined}
                  filledBy={a.filledBy}
                  score={a.affinity !== null ? <ScoreCell value={a.affinity * 100} size="sm" label="Affinity" /> : undefined}
                  info={
                    (a.trend !== null && a.trend >= 1) || usualNames.has(a.name) ? (
                      <>
                        {a.trend !== null && a.trend >= 1 && <InfoTag icon="trending">Rising +{a.trend.toFixed(1)}</InfoTag>}
                        {usualNames.has(a.name) && <InfoTag icon="usual">Usual crowd too</InfoTag>}
                      </>
                    ) : undefined
                  }
                >
                  {a.because.length > 0 && (
                    <Reason
                      text={[
                        "Because your fans like ",
                        ...(a.explained.length > 0 ? a.explained.map((e) => ({ name: e.name, score: Math.round(e.score <= 1 ? e.score * 100 : e.score) })) : a.because.map((name) => ({ name }))).flatMap((x, i) => [...(i ? [", "] : []), { kind: "artist" as const, ...x }]),
                        ownName && a.because.includes(ownName) ? ` (${ownName} is ${FROM_YOUR_MUSIC})` : "",
                      ]}
                    />
                  )}
                </ArtistChip>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {crowd.localScene && crowd.localScene.acts.length > 0 && (
        <Block title="Local scene" label="Local scene">
          <p data-testid="local-scene" className="m-0 text-[15px] leading-[22px]">
            {list(crowd.localScene.genres.map((g) => g.name))}: acts your fans would like
          </p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {crowd.localScene.acts.map((a) => (
              <li key={a.name}>
                <ArtistChip name={a.name} image={a.image} filledBy={a.filledBy} score={a.affinity !== null ? <ScoreCell value={a.affinity * 100} size="sm" label="Affinity" /> : undefined} />
              </li>
            ))}
          </ul>
        </Block>
      )}

      {(crowd.contrast || crowd.usualCrowd) && (
        <Block title="Your fans vs the usual crowd" label="Compared with the usual crowd">
          {crowd.usualCrowd && <Why>The crowd at {crowd.usualCrowd.hotspot} likes {list(crowd.usualCrowd.artists.map((a) => a.name))}.</Why>}
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
        </Block>
      )}

      {crowd.genres.length > 0 && (
        <Block title={`Genres around ${topPitch ?? "the top pitch"}`} label="Genres at the top pitch">
          <ul className={meters}>
            {crowd.genres.map((g) => (
              <MeterBar key={g.name} label={g.name} value={g.affinity} />
            ))}
          </ul>
        </Block>
      )}

      {((crowd.demographics && (crowd.demographics.age.length > 0 || crowd.demographics.gender.length > 0)) || fans) && (
        <Block title="Who your fans are" label="Age and gender lean">
          {fansTop && (
            <p data-testid="fans-compare" className="m-0 text-[15px] leading-[22px]">
              Your fans lean {fansTop}
              {crowdTop ? `; this crowd leans ${crowdTop}` : ""}.
            </p>
          )}
          {fans && fans.age.length > 0 && (
            <div className="grid gap-1.5">
              <Caption>Your fans ({ownArtist!.name})</Caption>
              <ul className="m-0 grid list-none gap-1.5 p-0" aria-label={`Lean by age band for fans of ${ownArtist!.name}, against the average audience`}>
                {fans.age.map((a) => (
                  <LeanBar key={a.band} label={ageLabel(a.band)} lean={a.lean} max={fansMax} />
                ))}
              </ul>
              {crowd.demographics && <Caption>This crowd</Caption>}
            </div>
          )}
          {crowd.demographics && (
            <ul className="m-0 grid list-none gap-1.5 p-0" aria-label="Lean by age band and gender, against the average audience">
              {crowd.demographics.age.map((a) => (
                <LeanBar key={a.band} label={ageLabel(a.band)} lean={a.lean} max={leanMax} />
              ))}
              {crowd.demographics.gender.map((g) => (
                <LeanBar key={g.band} label={g.band[0].toUpperCase() + g.band.slice(1)} lean={g.lean} max={leanMax} />
              ))}
            </ul>
          )}
        </Block>
      )}

      {unmatched.length > 0 && !empty && <p className="m-0 mt-2 text-sm leading-5 text-muted-foreground">Qloo couldn&apos;t match: {unmatched.join(", ")}.</p>}
    </section>
  );
}
