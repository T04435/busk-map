"use client";

import { XIcon } from "lucide-react";
import { useId, useState, type Dispatch, type SetStateAction } from "react";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { FormMessage } from "@/components/honeycomb/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/live-search";
import { type PickedArtist } from "./artist-picker";
import { SongCover, SongSearch } from "./song-search";

// "|" and "~" separate values in the plan URL.
const clean = (s: string) => s.replace(/[|~]/g, " ").trim();

/** A song picked from Spotify (search or "Load my songs"), with what the search showed. */
export type PickedSong = { key: string; title: string; artist: string; album: string | null; image: string | null; durationMs: number | null; own: boolean };

export const toPicked = (track: TrackResult, own: boolean): PickedSong => ({
  key: track.id,
  title: clean(track.title),
  artist: clean(track.artists[0]?.name ?? "") || "Unknown artist",
  album: track.album,
  image: track.image,
  durationMs: track.durationMs,
  own,
});

/** The most songs one act can pick. */
const MAX_PICKED = 60;

/** The songs you picked: a cover cell, title, "artist · album", a "Your song" badge, the length and a remove button. */
export function PickedSongs({ songs, onRemove }: { songs: PickedSong[]; onRemove: (song: PickedSong) => void }) {
  if (songs.length === 0) return null;
  return (
    <ul aria-label="Songs you picked" className="m-0 list-none divide-y divide-border border-2 border-rule bg-card p-0 text-sm">
      {songs.map((song) => (
        <li key={song.key} className="flex items-center gap-3 px-3 py-1.5">
          <SongCover image={song.image} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{song.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{[song.artist, song.album].filter(Boolean).join(" · ")}</span>
          </span>
          {song.own && <Badge variant="solid">Your song</Badge>}
          {song.durationMs !== null && <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatDuration(song.durationMs)}</span>}
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${song.title}`} onClick={() => onRemove(song)}>
            <XIcon aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Songs you can play": search Spotify and pick, load your own songs from your Spotify artist link, or type the ones
 * Spotify doesn't have, one per line. The picks sit in a list with their lengths. Songs by the artists you sound like
 * come first in the search.
 */
export function RepertoirePicker({
  artists,
  picked,
  setPicked,
  typed,
  onTypedChange,
  invalid,
  errorId,
  error,
}: {
  artists: PickedArtist[];
  picked: PickedSong[];
  setPicked: Dispatch<SetStateAction<PickedSong[]>>;
  /** The "Title - Artist" lines typed by hand. */
  typed: string;
  onTypedChange: (text: string) => void;
  invalid?: boolean;
  errorId?: string;
  /** The field's error, shown under the list. */
  error?: string | null;
}) {
  const [spotifyLink, setSpotifyLink] = useState("");
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const linkId = useId();

  function addSongs(next: PickedSong[]) {
    setPicked((current) => [...current, ...next.filter((song) => !current.some((c) => c.key === song.key))].slice(0, MAX_PICKED));
  }

  async function loadOwnSongs() {
    setSearchNote("Loading your songs from Spotify…");
    const res = await fetch(`/api/repertoire?${new URLSearchParams({ type: "artist", link: spotifyLink })}`).catch(() => null);
    const body = res?.ok ? await res.json() : null;
    const tracks: TrackResult[] = body?.tracks ?? [];
    if (!tracks.length) {
      setSearchNote(
        res?.status === 429
          ? "Too many searches in a short time. Wait a moment and try again."
          : body?.reason === "not_found"
            ? "Spotify has no artist at that link. Open it in Spotify to check it, then copy the artist's share link again."
            : body?.mode === "fallback"
              ? "Spotify isn't answering right now. Try again in a minute, or type your songs below."
              : "Couldn't load songs from that link. Paste an open.spotify.com/artist/… link, or type your songs.",
      );
      return;
    }
    addSongs(tracks.slice(0, 20).map((t) => toPicked(t, true)));
    setSearchNote(
      body?.mode === "synthetic"
        ? "Offline test mode: these songs are made up, not from Spotify."
        : `Added ${Math.min(tracks.length, 20)} of your songs from Spotify. Remove any you don't play.`,
    );
  }

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1 p-0 text-label font-bold">Songs you can play</legend>
      <SongSearch onAdd={(track) => addSongs([toPicked(track, false)])} isAdded={(track) => picked.some((p) => p.key === track.id)} artists={artists} />
      <PickedSongs songs={picked} onRemove={(song) => setPicked((current) => current.filter((p) => p !== song))} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor={linkId} className="sr-only">
            Your Spotify artist link
          </Label>
          <Input id={linkId} value={spotifyLink} onChange={(e) => setSpotifyLink(e.target.value)} placeholder="Your Spotify artist link (optional)" />
        </div>
        <Button type="button" variant="outline" className="self-start sm:self-auto" onClick={() => void loadOwnSongs()} disabled={spotifyLink.trim().length < 10}>
          Load my songs
        </Button>
      </div>
      <div aria-live="polite">{searchNote && <FormMessage>{searchNote}</FormMessage>}</div>
      <div className="space-y-1">
        <Label htmlFor="songs" className="font-normal! text-muted-foreground">
          Song list: type songs Spotify doesn&apos;t have
        </Label>
        <Textarea
          id="songs"
          value={typed}
          onChange={(e) => onTypedChange(e.target.value)}
          rows={4}
          aria-invalid={invalid || undefined}
          placeholder={"One per line: Title - Artist\nHow to Make Gravy - Paul Kelly\nMy Song - Me (own)"}
        />
      </div>
      {error ? (
        <FormMessage tone="error" id={errorId} alert={false}>
          {error}
        </FormMessage>
      ) : null}
    </fieldset>
  );
}
