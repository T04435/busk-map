"use client";

import { cn } from "cn";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";
import { Chip } from "@/components/honeycomb/chip";
import { Icon } from "@/components/honeycomb/icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RepertoireProfile as Profile } from "./repertoire/types";

/** 12400 -> "12.4K", 1250000 -> "1.3M". */
export function formatFollowers(n: number): string {
  const compact = (v: number, unit: string) => `${(Math.round(v * 10) / 10).toString().replace(/\.0$/, "")}${unit}`;
  if (n >= 1_000_000) return compact(n / 1_000_000, "M");
  if (n >= 1_000) return compact(n / 1_000, "K");
  return String(n);
}

const qlooChip = "border-qloo text-qloo";

/**
 * THE act's profile: photo cell, name, followers, a Spotify link, genres, the Qloo audience tags, the lead paragraph and two
 * actions. `size` lg is the page header (the Repertoire results, h1); md is the inline block on the form (smaller name and photo, h2).
 * Without a profile it draws the loading skeleton, or, with `onLoad`, a button that loads one; otherwise nothing.
 */
export function ArtistProfile({
  profile,
  summary,
  size = "lg",
  maxGenres,
  onRefresh,
  onEditLink,
  onLoad,
  busy,
  loading,
  loadLabel = "Load my profile",
  loadingLabel = "Loading your profile",
  refreshLabel = "Refresh my research",
  refreshingLabel = "Refreshing",
  className,
}: {
  profile: Profile | null;
  summary?: string | null;
  size?: "lg" | "md";
  /** Show at most this many genres. */
  maxGenres?: number;
  onRefresh?: () => void;
  onEditLink?: () => void;
  /** With no profile yet: offers "Load my profile". */
  onLoad?: () => void;
  /** A refresh or load is running: the buttons are disabled and say so. */
  busy?: boolean;
  loading?: boolean;
  /** Button copy (PLAYLIST_COPY.profile.* on the form); the defaults are the Repertoire's. */
  loadLabel?: string;
  loadingLabel?: string;
  refreshLabel?: string;
  refreshingLabel?: string;
  className?: string;
}) {
  if (!profile && !loading) {
    if (!onLoad) return null;
    return (
      <div data-slot="artist-profile" className={className}>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onLoad} className="min-h-12 sm:min-h-0">
          {busy ? loadingLabel : loadLabel}
        </Button>
      </div>
    );
  }
  const lg = size === "lg";
  const Heading = lg ? "h1" : "h2";
  const genres = profile ? (maxGenres != null ? profile.genres.slice(0, maxGenres) : profile.genres) : [];
  const photo = (size: number) => (
    <HexCell size={size} tone="media" image={profile?.image} label={profile ? `${profile.name}` : undefined} fontSize={Math.round(size * 0.36)}>
      {profile ? initialsOf(profile.name) : null}
    </HexCell>
  );
  return (
    <header data-slot="artist-profile" data-testid="profile-header" className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-start gap-4 md:gap-8">
        {profile ? (
          <>
            <span className={lg ? "md:hidden" : undefined}>{photo(88)}</span>
            {lg ? <span className="hidden md:block">{photo(120)}</span> : null}
          </>
        ) : (
          <>
            <Skeleton shape="cell" className={cn("h-[101.6px] w-[88px] flex-none", lg && "md:hidden")} />
            {lg ? <Skeleton shape="cell" className="hidden h-[138.6px] w-[120px] flex-none md:block" /> : null}
          </>
        )}
        <div className="min-w-0 flex-1">
          {profile ? (
            <>
              <Heading
                id="profile-name"
                data-testid="profile-name"
                className={cn(
                  "m-0 font-display font-extrabold text-balance uppercase [overflow-wrap:anywhere]",
                  lg ? "text-[clamp(36px,6vw,72px)] leading-[0.98]" : "text-[clamp(26px,4vw,36px)] leading-none",
                )}
              >
                {profile.name}
              </Heading>
              {profile.followers != null || profile.href ? (
                <p className="mt-2 mb-0 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm text-muted-foreground">
                  {profile.followers != null ? <span>{formatFollowers(profile.followers)} followers</span> : null}
                  {profile.href ? (
                    <a
                      href={profile.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-6 items-center gap-1 text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none"
                    >
                      Spotify
                      <Icon name="external" size={14} />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : (
            <div role="status" aria-label="Reading your profile" className="flex flex-col gap-3">
              <Skeleton className="h-10 w-3/4 md:h-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          )}
        </div>
      </div>

      {profile && (genres.length > 0 || profile.audience.length > 0) ? (
        <div className="flex flex-col gap-4">
          {genres.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {genres.map((g) => (
                <li key={g}>
                  <Chip>{g}</Chip>
                </li>
              ))}
            </ul>
          ) : null}
          {profile.audience.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-mono text-xs font-bold tracking-[0.08em] text-qloo uppercase">Your audience, by Qloo</span>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {profile.audience.map((a) => (
                  <li key={a}>
                    <Chip className={qlooChip}>{a}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <p className={cn("m-0 max-w-2xl text-pretty", lg ? "text-lg leading-7" : "text-base leading-6")}>{summary}</p>
      ) : loading ? (
        <div className="flex max-w-2xl flex-col gap-2" role="status" aria-label="Summing up your act">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : null}

      {profile && (onRefresh || onEditLink) ? (
        <div className="flex flex-wrap gap-2">
          {onRefresh ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRefresh} className="min-h-12 sm:min-h-0">
              <Icon name="refresh" size={16} />
              {busy ? refreshingLabel : refreshLabel}
            </Button>
          ) : null}
          {onEditLink ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onEditLink} className="min-h-12 sm:min-h-0">
              <Icon name="pencil" size={16} />
              Change link
            </Button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
