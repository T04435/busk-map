"use client";

import { Chip } from "@/components/honeycomb/chip";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";
import { Button } from "@/components/ui/button";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";
import type { SpotifyProfile } from "@/lib/playlist-schema";

const MAX_GENRES = 5;
const PHOTO_PX = 160;

/** The smallest photo at least PHOTO_PX wide, else the first one; https only. Null when there is none. */
export function profilePhoto(images: SpotifyProfile["images"]): string | null {
  const usable = images.filter((i) => i.url.startsWith("https://"));
  const wide = usable.filter((i) => (i.width ?? 0) >= PHOTO_PX).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (wide[0] ?? usable[0])?.url ?? null;
}

/**
 * The Spotify profile of the Repertoire's artist: photo in a hex cell (the hex mark with initials when there is no
 * photo), the name, and genres as chips. Nothing without a saved Spotify link. With a link but no snapshot yet it offers
 * to load one; it never loads by itself. Without `onRefresh` it is read-only: no buttons, and nothing without a snapshot.
 */
export function ProfileHeader({ profile, hasLink, busy = false, onRefresh }: { profile: SpotifyProfile | null | undefined; hasLink: boolean; busy?: boolean; onRefresh?: () => void }) {
  if (!hasLink) return null;
  if (!profile) {
    if (!onRefresh) return null;
    return (
      <div data-testid="profile-header">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRefresh}>
          {busy ? COPY.profile.refreshing : COPY.profile.loadProfile}
        </Button>
      </div>
    );
  }
  return (
    <section aria-labelledby="profile-name" data-testid="profile-header" className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <HexCell size={88} image={profilePhoto(profile.images)} tone="muted">
        {initialsOf(profile.name)}
      </HexCell>
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-2">
        <h2 id="profile-name" className="m-0 font-display text-[clamp(26px,4vw,36px)] leading-none font-extrabold uppercase [overflow-wrap:anywhere]" data-testid="profile-name">
          {profile.name}
        </h2>
        {profile.genres.length > 0 && (
          <ul aria-label="Genres" className="m-0 flex list-none flex-wrap gap-2 p-0">
            {profile.genres.slice(0, MAX_GENRES).map((genre) => (
              <li key={genre}>
                <Chip>{genre}</Chip>
              </li>
            ))}
          </ul>
        )}
        {typeof profile.followers === "number" && <p className="m-0 font-mono text-xs text-muted-foreground">{COPY.profile.followers(profile.followers)}</p>}
      </div>
      {onRefresh && (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRefresh} aria-label={`${COPY.profile.refreshProfile}: ${profile.name}`}>
          {busy ? COPY.profile.refreshing : COPY.profile.refreshProfile}
        </Button>
      )}
    </section>
  );
}
