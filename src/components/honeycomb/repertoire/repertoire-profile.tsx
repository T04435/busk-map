"use client";

import { cn } from "cn";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";
import { Chip } from "@/components/honeycomb/chip";
import { Icon } from "@/components/honeycomb/icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RepertoireProfile as Profile } from "./types";

/** 12400 -> "12.4K", 1250000 -> "1.3M". */
export function formatFollowers(n: number): string {
  const compact = (v: number, unit: string) => `${(Math.round(v * 10) / 10).toString().replace(/\.0$/, "")}${unit}`;
  if (n >= 1_000_000) return compact(n / 1_000_000, "M");
  if (n >= 1_000) return compact(n / 1_000, "K");
  return String(n);
}

const qlooChip = "border-qloo text-qloo";

/** The results header: photo cell, name, followers, genres, the Qloo audience tags, the lead paragraph and two actions. */
export function RepertoireProfile({
  profile,
  summary,
  onRefresh,
  onEditLink,
  loading,
  className,
}: {
  profile: Profile | null;
  summary?: string | null;
  onRefresh?: () => void;
  onEditLink?: () => void;
  loading?: boolean;
  className?: string;
}) {
  if (!profile && !loading) return null;
  const photo = (size: number) => (
    <HexCell size={size} tone="media" image={profile?.image} label={profile ? `${profile.name}` : undefined} fontSize={Math.round(size * 0.36)}>
      {profile ? initialsOf(profile.name) : null}
    </HexCell>
  );
  return (
    <header data-slot="repertoire-profile" className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-start gap-4 md:gap-8">
        {profile ? (
          <>
            <span className="md:hidden">{photo(88)}</span>
            <span className="hidden md:block">{photo(120)}</span>
          </>
        ) : (
          <>
            <Skeleton shape="cell" className="h-[101.6px] w-[88px] flex-none md:hidden" />
            <Skeleton shape="cell" className="hidden h-[138.6px] w-[120px] flex-none md:block" />
          </>
        )}
        <div className="min-w-0 flex-1">
          {profile ? (
            <>
              <h1 className="m-0 font-display text-[clamp(36px,6vw,72px)] leading-[0.98] font-extrabold text-balance uppercase [overflow-wrap:anywhere]">
                {profile.name}
              </h1>
              {profile.followers != null ? (
                <p className="mt-2 mb-0 font-mono text-sm text-muted-foreground">{formatFollowers(profile.followers)} followers</p>
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

      {profile && (profile.genres.length > 0 || profile.audience.length > 0) ? (
        <div className="flex flex-col gap-4">
          {profile.genres.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {profile.genres.map((g) => (
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
        <p className="m-0 max-w-2xl text-lg leading-7 text-pretty">{summary}</p>
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
            <Button type="button" variant="ghost" size="sm" onClick={onRefresh} className="min-h-12 sm:min-h-0">
              <Icon name="refresh" size={16} />
              Refresh my research
            </Button>
          ) : null}
          {onEditLink ? (
            <Button type="button" variant="ghost" size="sm" onClick={onEditLink} className="min-h-12 sm:min-h-0">
              <Icon name="pencil" size={16} />
              Change link
            </Button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
