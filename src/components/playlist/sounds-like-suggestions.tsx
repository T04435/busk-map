"use client";

import { useEffect, useState } from "react";
import { ArtistChip, ArtistChipList } from "@/components/honeycomb/artist-chip";
import { Button } from "@/components/ui/button";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";
import type { SoundsLikeSuggestions } from "@/lib/playlist-schema";
import { MAX_PICKED_ARTISTS, type PickedArtist } from "@/components/landing/artist-picker";
import { SPOTIFY_ARTIST_URL } from "@/lib/mention";
import { loadSoundsLike } from "./playlist-api";

/** The picker's list with suggestions added (skipping ones it already has, up to the picker's maximum). A suggestion keeps its Spotify id (when Qloo has one) and its Qloo id, so it is never shown as typed. */
export function withSuggested(current: PickedArtist[], add: readonly { name: string; spotifyId?: string; qlooId?: string; image?: string }[]): PickedArtist[] {
  const next = [...current];
  for (const { name, spotifyId, qlooId, image } of add) {
    if (next.length >= MAX_PICKED_ARTISTS) break;
    if (!next.some((a) => a.name.toLowerCase() === name.toLowerCase())) next.push({ name, spotifyId: spotifyId ?? null, qlooId: qlooId ?? null, image: image ?? null });
  }
  return next;
}

type Suggested = SoundsLikeSuggestions["artists"][number];

/**
 * Qloo's "artists you sound like" for the saved Spotify artist, offered as suggestions under the picker. Nothing is picked
 * for you: "Add" hands the artist to the parent's own list (which saves the way it always did), and added ones disappear.
 * It reads the server's saved Qloo artist, so it never looks the artist up again; `refreshKey` changes when the profile does.
 * When Qloo doesn't know the artist: one quiet line, no chips.
 */
export function SoundsLikeSuggestionsList({ enabled, refreshKey, picked, onAdd }: { enabled: boolean; refreshKey: string; picked: readonly string[]; onAdd: (artists: Suggested[]) => void }) {
  const [state, setState] = useState<{ key: string; data: SoundsLikeSuggestions } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void loadSoundsLike(controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ key: refreshKey, data });
    });
    return () => controller.abort();
  }, [enabled, refreshKey]);

  if (!enabled) return null;
  if (!state || state.key !== refreshKey) {
    return (
      <p role="status" className="m-0 text-sm text-muted-foreground">
        {COPY.soundsLike.loading}
      </p>
    );
  }
  const { status, artists } = state.data;
  if (status === "unknown_artist") return <p className="m-0 text-sm text-muted-foreground" data-testid="sounds-like-note">{COPY.soundsLike.unknown}</p>;
  if (status === "unavailable") return <p className="m-0 text-sm text-muted-foreground" data-testid="sounds-like-note">{COPY.soundsLike.unavailable}</p>;
  const has = new Set(picked.map((n) => n.toLowerCase()));
  const open = artists.filter((a) => !has.has(a.name.toLowerCase()));
  if (status !== "ok" || open.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="sounds-like-suggestions">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="m-0 text-sm font-bold">{COPY.soundsLike.heading}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => onAdd(open)}>
          {COPY.soundsLike.addAll}
        </Button>
      </div>
      <ArtistChipList>
        {open.map((artist) => (
          <li key={artist.qlooId}>
            <ArtistChip name={artist.name} image={artist.image} href={artist.spotifyId ? SPOTIFY_ARTIST_URL(artist.spotifyId) : undefined} source="qloo" tags={artist.tags} state="suggested" onAdd={() => onAdd([artist])} />
          </li>
        ))}
      </ArtistChipList>
    </div>
  );
}
