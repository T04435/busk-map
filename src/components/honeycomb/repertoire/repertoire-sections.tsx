"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { ArtistChip, ArtistChipList } from "@/components/honeycomb/artist-chip";
import { Icon } from "@/components/honeycomb/icon";
import { LeanBar } from "@/components/honeycomb/lean-bar";
import { mentionArtists } from "@/components/honeycomb/mention";
import { Reason } from "@/components/honeycomb/reason";
import { SongActions } from "@/components/honeycomb/song-actions";
import { SongRow } from "@/components/honeycomb/song-row";
import { SongTag } from "@/components/honeycomb/song-tag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { FanLean, LearnSong, ResearchArtist, ResearchSong } from "./types";

const subLabel = "m-0 font-mono text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase";

/** A section: a 2px rule, a display-caps h2, an optional muted intro and the body. */
function Section({
  title,
  aside,
  intro,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  intro?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section data-slot="repertoire-section" className={cn("border-t-2 border-rule pt-6", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 font-display text-[clamp(28px,3.4vw,36px)] leading-none font-extrabold uppercase">{title}</h2>
        {aside}
      </div>
      {intro ? <p className="mt-2 mb-0 text-sm leading-5 text-muted-foreground">{intro}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SkeletonRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton shape="cell" className="h-[50.8px] w-11 flex-none" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

const addButtonClass = "mt-4 min-h-12 sm:min-h-0";

/* Who your fans are */

function LeanGroup({ label, items }: { label: string; items: FanLean[] }) {
  const max = Math.max(0.05, ...items.map((i) => Math.abs(i.lean)));
  return (
    <div className="flex flex-col gap-3">
      <h3 className={subLabel}>{label}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((i) => (
          <LeanBar key={i.label} label={i.label} lean={i.lean} max={max} />
        ))}
      </ul>
    </div>
  );
}

export function FansSection({
  fans,
  loading,
  className,
}: {
  fans: { age: FanLean[]; gender: FanLean[] } | null;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Section title="Who your fans are" className={className}>
      {fans ? (
        <div className="flex flex-col gap-6">
          {fans.age.length > 0 ? <LeanGroup label="Age" items={fans.age} /> : null}
          {fans.gender.length > 0 ? <LeanGroup label="Gender" items={fans.gender} /> : null}
          <p className="m-0 font-mono text-xs text-muted-foreground">
            Lean against the average <span className="text-qloo">Qloo</span> audience.
          </p>
        </div>
      ) : loading ? (
        <SkeletonRows rows={4} label="Finding who your fans are" />
      ) : null}
    </Section>
  );
}

/* Artists you sound like */

export function SoundsLikeSection({
  artists,
  suggestions,
  onAdd,
  onRemove,
  onAddSearch,
  loading,
  className,
}: {
  artists: ResearchArtist[] | null;
  suggestions?: ResearchArtist[] | null;
  onAdd?: (artist: ResearchArtist) => void;
  onRemove?: (artist: ResearchArtist) => void;
  onAddSearch?: () => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Section title="Artists you sound like" className={className}>
      {artists ? (
        <div className="flex flex-col gap-6">
          <ArtistChipList>
            {artists.map((a) => (
              <li key={a.name}>
                <ArtistChip name={a.name} image={a.image} source={a.source} tags={a.tags} state="picked" onRemove={onRemove ? () => onRemove(a) : undefined} />
              </li>
            ))}
          </ArtistChipList>
          {suggestions && suggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className={subLabel}>Your fans also love</h3>
              <ArtistChipList>
                {suggestions.map((a) => (
                  <li key={a.name}>
                    <ArtistChip name={a.name} image={a.image} source={a.source} tags={a.tags} state="suggested" onAdd={onAdd ? () => onAdd(a) : undefined} />
                  </li>
                ))}
              </ArtistChipList>
            </div>
          ) : null}
        </div>
      ) : loading ? (
        <SkeletonRows rows={3} label="Finding who you sound like" />
      ) : null}
      {onAddSearch ? (
        <Button type="button" variant="outline" size="sm" onClick={onAddSearch} className={addButtonClass}>
          <Icon name="plus" size={16} />
          Add an artist
        </Button>
      ) : null}
    </Section>
  );
}

/* Songs you can sing */

export function CanSingSection({
  songs,
  ownerImage,
  onRemove,
  onAddSong,
  loading,
  className,
}: {
  songs: ResearchSong[] | null;
  ownerImage?: string | null;
  onRemove?: (song: ResearchSong) => void;
  onAddSong?: () => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Section
      title="Songs you can sing"
      className={className}
      aside={songs ? <span className="font-mono text-sm text-muted-foreground">{songs.length}</span> : undefined}
    >
      {songs ? (
        <ul className="m-0 list-none divide-y divide-border p-0">
          {songs.map((s) => (
            <SongRow
              key={s.id}
              title={s.title}
              artist={s.artist}
              year={s.year}
              album={s.album}
              image={s.image}
              durationMs={s.durationMs}
              href={s.href ?? undefined}
              own={s.own}
              ownerImage={ownerImage ?? undefined}
              actions={onRemove ? <SongActions title={s.title} onRemove={() => onRemove(s)} /> : undefined}
            />
          ))}
        </ul>
      ) : loading ? (
        <SkeletonRows rows={4} label="Loading your songs" />
      ) : null}
      {onAddSong ? (
        <Button type="button" variant="outline" size="sm" onClick={onAddSong} className={addButtonClass}>
          <Icon name="plus" size={16} />
          Add a song
        </Button>
      ) : null}
    </Section>
  );
}

/* Songs you should learn */

function LearnRow({
  song,
  onLearned,
  onDismiss,
  onUndo,
}: {
  song: LearnSong;
  onLearned?: (song: LearnSong) => void;
  onDismiss?: (song: LearnSong) => void;
  onUndo?: (song: LearnSong) => void;
}) {
  const pending = song.status === "pending";
  return (
    <SongRow
      title={song.title}
      artist={song.artist}
      year={song.year}
      album={song.album}
      image={song.image}
      durationMs={song.durationMs}
      href={song.href ?? undefined}
      tags={song.fresh ? <SongTag kind="new" /> : undefined}
      muted={song.status === "dismissed"}
      actions={
        pending ? (
          <SongActions title={song.title} onLearned={() => onLearned?.(song)} onDismiss={() => onDismiss?.(song)} />
        ) : (
          <SongActions title={song.title} onUndo={() => onUndo?.(song)} />
        )
      }
      reason={<Reason text={mentionArtists(song.reason, (song.because ?? []).map((a) => ({ kind: "artist" as const, name: a.name, image: a.image })))} />}
    />
  );
}

export function ToLearnSection({
  songs,
  onLearned,
  onDismiss,
  onUndo,
  onFindMore,
  runsLeft,
  loading,
  className,
}: {
  songs: LearnSong[] | null;
  onLearned?: (song: LearnSong) => void;
  onDismiss?: (song: LearnSong) => void;
  onUndo?: (song: LearnSong) => void;
  onFindMore?: () => void;
  runsLeft?: number | null;
  loading?: boolean;
  className?: string;
}) {
  const pending = songs?.filter((s) => s.status === "pending") ?? [];
  const dismissed = songs?.filter((s) => s.status === "dismissed") ?? [];
  const learnedNow = songs?.filter((s) => s.status === "learned") ?? [];
  const rows = [...pending, ...learnedNow];
  return (
    <Section title="Songs you should learn" className={className} intro="Picked for your crowd, with the reason for each.">
      {songs ? (
        <>
          {rows.length > 0 ? (
            <ul className="m-0 list-none divide-y divide-border p-0">
              {rows.map((s) => (
                <LearnRow key={s.id} song={s} onLearned={onLearned} onDismiss={onDismiss} onUndo={onUndo} />
              ))}
            </ul>
          ) : null}
          {dismissed.length > 0 ? (
            <details data-slot="not-for-me" className="group/nfm mt-6 border-t-2 border-rule">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-mono text-xs font-bold tracking-[0.08em] uppercase select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none [&::-webkit-details-marker]:hidden">
                <span>Not for me ({dismissed.length})</span>
                <Icon name="chevron-down" size={18} className="transition-transform group-open/nfm:rotate-180" />
              </summary>
              <ul className="m-0 list-none divide-y divide-border p-0">
                {dismissed.map((s) => (
                  <LearnRow key={s.id} song={s} onLearned={onLearned} onDismiss={onDismiss} onUndo={onUndo} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : loading ? (
        <SkeletonRows rows={5} label="Choosing songs your fans would stop for" />
      ) : null}
      {songs && onFindMore ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="button" onClick={onFindMore} className="min-h-12 w-full sm:w-auto">
            Find more songs to learn
          </Button>
          {runsLeft != null ? <span className="font-mono text-xs text-muted-foreground">{runsLeft} runs left this hour</span> : null}
        </div>
      ) : null}
    </Section>
  );
}

/* Learned */

export function LearnedSection({
  songs,
  loading,
  className,
}: {
  songs: ResearchSong[] | null;
  loading?: boolean;
  className?: string;
}) {
  if (!songs && !loading) return null;
  return (
    <Section
      title="Learned"
      className={className}
      aside={songs ? <span className="font-mono text-sm text-muted-foreground">{songs.length}</span> : undefined}
    >
      {songs ? (
        <ul className="m-0 list-none divide-y divide-border p-0">
          {songs.map((s) => (
            <SongRow key={s.id} size="sm" title={s.title} artist={s.artist} year={s.year} album={s.album} image={s.image} href={s.href ?? undefined} className="py-2" />
          ))}
        </ul>
      ) : (
        <SkeletonRows rows={2} label="Loading what you have learned" />
      )}
    </Section>
  );
}

/* Layout */

/**
 * Phones: profile, songs to learn, sounds like, fans, can sing, learned. From 1024px: the profile full width, then
 * fans, sounds like, can sing and learned on the left and songs to learn (the payoff) on the right. The folded research
 * block closes the page behind a 2px rule.
 */
export function RepertoireResultsLayout({
  profile,
  fans,
  soundsLike,
  canSing,
  toLearn,
  learned,
  research,
  className,
}: {
  profile?: ReactNode;
  fans?: ReactNode;
  soundsLike?: ReactNode;
  canSing?: ReactNode;
  toLearn?: ReactNode;
  learned?: ReactNode;
  research?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="repertoire-results" className={cn("mx-auto w-full max-w-[1200px]", className)}>
      {profile}
      <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="order-1 lg:order-2 lg:sticky lg:top-24 lg:self-start">{toLearn}</div>
        <div className="order-2 flex flex-col gap-14 lg:order-1">
          {soundsLike ? <div className="lg:order-2">{soundsLike}</div> : null}
          {fans ? <div className="lg:order-1">{fans}</div> : null}
          {canSing ? <div className="lg:order-3">{canSing}</div> : null}
          {learned ? <div className="lg:order-4">{learned}</div> : null}
        </div>
      </div>
      {research ? <div className="mt-14 border-t-2 border-rule pt-8">{research}</div> : null}
    </div>
  );
}
