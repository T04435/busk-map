"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "cn";
import { ArtistChip, ArtistChipList } from "@/components/honeycomb/artist-chip";
import { Icon } from "@/components/honeycomb/icon";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import { LeanBar } from "@/components/honeycomb/lean-bar";
import { mentionArtists } from "@/components/honeycomb/mention";
import { Reason } from "@/components/honeycomb/reason";
import { SongActions } from "@/components/honeycomb/song-actions";
import { SongRow } from "@/components/honeycomb/song-row";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { FanLean, LearnSong, ResearchArtist, ResearchSong } from "./types";

const subLabel = "m-0 font-mono text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase";

/** A section: a 2px rule, a display-caps h2 and the body. */
export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section data-slot="repertoire-section" className={cn("border-t-2 border-rule pt-6", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 font-display text-[clamp(28px,3.4vw,36px)] leading-none font-extrabold uppercase">{title}</h2>
        {aside}
      </div>
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

/** The song lists' height limit (U37): 420px on a phone, 560px from lg. A `max-h-*` class string; each list scrolls inside it. */
export const LIST_MAX_HEIGHT = "max-h-[420px] lg:max-h-[560px]";

/** A song list in the shared ScrollArea (U37): grows to `maxHeight`, then scrolls; the header and the actions stay outside it. */
function SongScroll({ label, maxHeight = LIST_MAX_HEIGHT, children }: { label: string; maxHeight?: string; children: ReactNode }) {
  return (
    <ScrollArea label={label} maxHeight={maxHeight} className="border-y border-border">
      <div className="pr-3 pl-2">{children}</div>
    </ScrollArea>
  );
}

/** The layout's `canSingFilter` slot, handed to CanSingSection so the filter sits above its list, under its heading. */
const CanSingFilterContext = createContext<ReactNode>(null);

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
    <Section title="Who your fans are" aside={fans ? <SourceLogo source="qloo" height={18} className="self-center" /> : undefined} className={className}>
      {fans ? (
        <div className="flex flex-col gap-6">
          {fans.age.length > 0 ? <LeanGroup label="Age" items={fans.age} /> : null}
          {fans.gender.length > 0 ? <LeanGroup label="Gender" items={fans.gender} /> : null}
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

/** "What your fans also love" (U39) as its own section, so the layout can pair it with Artists you sound like. */
export function FansLoveSection({
  artists,
  onAdd,
  loading,
  className,
}: {
  artists: ResearchArtist[] | null;
  onAdd?: (artist: ResearchArtist) => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Section title="What your fans also love" className={className}>
      {artists ? (
        <ArtistChipList>
          {artists.map((a) => (
            <li key={a.name}>
              <ArtistChip name={a.name} image={a.image} source={a.source} tags={a.tags} state="suggested" onAdd={onAdd ? () => onAdd(a) : undefined} />
            </li>
          ))}
        </ArtistChipList>
      ) : loading ? (
        <SkeletonRows rows={3} label="Finding what your fans also love" />
      ) : null}
    </Section>
  );
}

/* Songs you can sing */

export function CanSingSection({
  songs,
  onRemove,
  onAddSong,
  filter,
  maxHeight,
  loading,
  className,
}: {
  songs: ResearchSong[] | null;
  onRemove?: (song: ResearchSong) => void;
  onAddSong?: () => void;
  /** A filter field, above the scrolling list. Falls back to the layout's `canSingFilter` slot. */
  filter?: ReactNode;
  /** A `max-h-*` class string for the list's ScrollArea (default 420px, 560px from lg). */
  maxHeight?: string;
  loading?: boolean;
  className?: string;
}) {
  const slotFilter = useContext(CanSingFilterContext);
  const filterNode = filter ?? slotFilter;
  return (
    <Section
      title="Songs you can sing"
      className={className}
      aside={songs ? <span className="font-mono text-sm text-muted-foreground">{songs.length}</span> : undefined}
    >
      {filterNode ? <div data-slot="song-filter" className="mb-4">{filterNode}</div> : null}
      {songs ? (
        <SongScroll label="Songs you can sing" maxHeight={maxHeight}>
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
                actions={onRemove ? <SongActions title={s.title} onRemove={() => onRemove(s)} /> : undefined}
              />
            ))}
          </ul>
        </SongScroll>
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
  maxHeight,
  loading,
  className,
}: {
  songs: LearnSong[] | null;
  onLearned?: (song: LearnSong) => void;
  onDismiss?: (song: LearnSong) => void;
  onUndo?: (song: LearnSong) => void;
  onFindMore?: () => void;
  runsLeft?: number | null;
  /** A `max-h-*` class string for the list's ScrollArea (default 420px, 560px from lg). */
  maxHeight?: string;
  loading?: boolean;
  className?: string;
}) {
  const pending = songs?.filter((s) => s.status === "pending") ?? [];
  const dismissed = songs?.filter((s) => s.status === "dismissed") ?? [];
  const learnedNow = songs?.filter((s) => s.status === "learned") ?? [];
  const rows = [...pending, ...learnedNow];
  return (
    <Section title="Songs you should learn" className={className}>
      {songs ? (
        <>
          {rows.length > 0 || dismissed.length > 0 ? (
            <SongScroll label="Songs you should learn" maxHeight={maxHeight}>
              {rows.length > 0 ? (
                <ul className="m-0 list-none divide-y divide-border p-0">
                  {rows.map((s) => (
                    <LearnRow key={s.id} song={s} onLearned={onLearned} onDismiss={onDismiss} onUndo={onUndo} />
                  ))}
                </ul>
              ) : null}
          {dismissed.length > 0 ? (
            <Collapsible data-slot="not-for-me" className="group/nfm mt-6 border-t-2 border-rule">
              <CollapsibleTrigger className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 text-left font-mono text-xs font-bold tracking-[0.08em] uppercase select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none">
                <span>Not for me ({dismissed.length})</span>
                <Icon name="chevron-down" size={18} className="transition-transform group-data-[state=open]/nfm:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent forceMount>
                <ul className="m-0 list-none divide-y divide-border p-0">
                  {dismissed.map((s) => (
                    <LearnRow key={s.id} song={s} onLearned={onLearned} onDismiss={onDismiss} onUndo={onUndo} />
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
            </SongScroll>
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
  maxHeight = "max-h-[280px] lg:max-h-[320px]",
  loading,
  className,
}: {
  songs: ResearchSong[] | null;
  /** A `max-h-*` class string for the list's ScrollArea (default 280px, 320px from lg). */
  maxHeight?: string;
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
        <SongScroll label="Learned" maxHeight={maxHeight}>
          <ul className="m-0 list-none divide-y divide-border p-0">
            {songs.map((s) => (
              <SongRow key={s.id} size="sm" title={s.title} artist={s.artist} year={s.year} album={s.album} image={s.image} href={s.href ?? undefined} className="py-2" />
            ))}
          </ul>
        </SongScroll>
      ) : (
        <SkeletonRows rows={2} label="Loading what you have learned" />
      )}
    </Section>
  );
}

/* Layout */

/** A row of the results: one column on a phone, two equal columns from lg. */
const row = "grid min-w-0 gap-14 lg:grid-cols-2 lg:items-start lg:gap-x-12";

/**
 * The Repertoire results as rows (U37 to U43; replaces the U25 two-column split). One DOM order in both phases, and only CSS moves the
 * research, so nothing remounts when the run finishes (the map keeps its tiles). From lg each row is two columns; a phone is one column in
 * the same order.
 * 1. The act: left the profile (photo, name, genre tags under the name) and the act name field; right "Your audience".
 * 2. Fans: left Who your fans are; right Artists you sound like above What your fans also love.
 * 3. The fans map, full width.
 * 4. Songs: left Songs you can sing (its filter above its ScrollArea); right Songs you should learn, with Learned under it.
 * 5. "Your act, in a paragraph", full width, then 6. the research, full width. While it runs the research leads (CSS order).
 */
export function RepertoireResultsLayout({
  phase,
  profile,
  actName,
  audience,
  fans,
  soundsLike,
  fansLove,
  fansMap,
  canSingFilter,
  canSing,
  toLearn,
  learned,
  summary,
  research,
  className,
}: {
  phase: "running" | "done";
  /** ArtistProfile with `audience={false}` and `summary={false}`. */
  profile?: ReactNode;
  /** The Act name field, under the profile. */
  actName?: ReactNode;
  /** AudienceTags. */
  audience?: ReactNode;
  fans?: ReactNode;
  /** Artists you sound like (editable). */
  soundsLike?: ReactNode;
  /** What your fans also love (FansLoveSection), under soundsLike. */
  fansLove?: ReactNode;
  fansMap?: ReactNode;
  /** The filter field for Songs you can sing: drawn inside CanSingSection, above its list. */
  canSingFilter?: ReactNode;
  canSing?: ReactNode;
  toLearn?: ReactNode;
  learned?: ReactNode;
  /** ActSummary: full width after the songs, right before the research. */
  summary?: ReactNode;
  research?: ReactNode;
  className?: string;
}) {
  const done = phase === "done";
  return (
    <CanSingFilterContext.Provider value={canSingFilter ?? null}>
      <div data-slot="repertoire-results" data-phase={phase} className={cn("mx-auto flex w-full max-w-[1200px] flex-col gap-14", className)}>
        <div data-slot="repertoire-act" className={row}>
          <div className="flex min-w-0 flex-col gap-6">
            {profile}
            {actName}
          </div>
          {audience ? <div className="min-w-0">{audience}</div> : null}
        </div>
        <div data-slot="repertoire-fans" className={row}>
          <div className="min-w-0">{fans}</div>
          <div className="flex min-w-0 flex-col gap-14">
            {soundsLike}
            {fansLove}
          </div>
        </div>
        {fansMap ? (
          <div data-slot="repertoire-map" className="min-w-0">
            {fansMap}
          </div>
        ) : null}
        <div data-slot="repertoire-songs" className={row}>
          <div className="min-w-0">{canSing}</div>
          <div className="flex min-w-0 flex-col gap-14">
            {toLearn}
            {learned}
          </div>
        </div>
        {summary ? (
          <div data-slot="repertoire-summary" className="min-w-0">
            {summary}
          </div>
        ) : null}
        {research ? (
          <div data-slot="repertoire-research" className={cn("min-w-0", done ? "border-t-2 border-rule pt-8" : "order-first")}>
            {research}
          </div>
        ) : null}
      </div>
    </CanSingFilterContext.Provider>
  );
}
