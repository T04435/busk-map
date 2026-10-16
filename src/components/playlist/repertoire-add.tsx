"use client";

import { useRef, useState } from "react";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { SongSearch } from "@/components/landing/song-search";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/honeycomb/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import type { ActArtist } from "@/lib/track-rank";

const MAX_OWN = 20;

/** Why a profile link gave no songs, in words. */
function profileProblem(status: number | undefined, body: { reason?: string; mode?: string } | null): string {
  if (status === 429) return "Too many searches in a short time. Wait a moment and try again.";
  if (body?.reason === "not_found") return "Spotify has no artist at that link. Open it in Spotify to check it, then copy the artist's share link again.";
  if (body?.reason === "missing_key") return "Loading songs from a Spotify profile isn't available here. Search for a song below instead.";
  if (body?.mode === "fallback") return "Spotify isn't answering right now. Try again in a minute, or search for a song below.";
  return "Couldn't load songs from that link. Paste an open.spotify.com/artist/… link, or search for a song below.";
}

/**
 * Adding songs, one flow (user, 17 Oct): step 1 is the optional Spotify artist profile (your own songs, loaded on Enter or
 * when you leave the field), step 2 is ONE Spotify song search. When Spotify has no match, a "type it in" form appears under the
 * search, prefilled from the query. Used on the Repertoire page and in "Edit for this busk".
 */
export function RepertoireAdd({
  artists,
  isAdded,
  onAddTrack,
  onAddTyped,
  onAddOwn,
}: {
  artists: readonly ActArtist[];
  isAdded: (track: TrackResult) => boolean;
  onAddTrack: (track: TrackResult) => void;
  onAddTyped: (song: { title: string; artist: string }) => void | Promise<unknown>;
  /** The songs found on the artist's profile (up to 20). */
  onAddOwn: (tracks: TrackResult[]) => void | Promise<unknown>;
}) {
  const [link, setLink] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const loaded = useRef("");

  async function load() {
    const value = link.trim();
    if (value.length < 10 || loaded.current === value) return;
    loaded.current = value;
    setNote("Loading your songs from Spotify…");
    const res = await fetch(`/api/repertoire?${new URLSearchParams({ type: "artist", link: value })}`).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    const tracks: TrackResult[] = body?.tracks ?? [];
    if (!tracks.length) {
      loaded.current = "";
      setNote(profileProblem(res?.status, body));
      return;
    }
    await onAddOwn(tracks.slice(0, MAX_OWN));
    setNote(
      body?.mode === "synthetic"
        ? "Offline test mode: these songs are made up, not from Spotify."
        : `Added ${Math.min(tracks.length, MAX_OWN)} of your songs from Spotify. Remove any you don't play.`,
    );
  }

  return (
    <div className="space-y-4" data-testid="repertoire-add">
      <div className="space-y-1">
        <Label htmlFor="spotify-profile">1. Your Spotify artist profile (optional)</Label>
        <p className="text-sm text-muted-foreground">If you release music, paste your profile link and we add your own songs, tagged Your song. No profile? Skip to step 2.</p>
        <InputGroup>
          <InputGroupAddon>
            <Icon name="spotify" size={18} />
          </InputGroupAddon>
          <InputGroupInput
            id="spotify-profile"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void load();
              }
            }}
            onBlur={() => void load()}
            placeholder="Spotify artist link"
            autoComplete="off"
          />
        </InputGroup>
        {note && (
          <p className="text-sm text-muted-foreground" role="status">
            {note}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">2. Add a song</p>
        <SongSearch artists={artists} isAdded={isAdded} onAdd={onAddTrack} onAddTyped={onAddTyped} />
      </div>
    </div>
  );
}
