"use client";

import { Loader2Icon, MusicIcon, XIcon } from "lucide-react";
import { useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { FormMessage } from "@/components/honeycomb/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
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
  if (songs.length === 0) return <p className="m-0 text-sm text-muted-foreground">Search for songs above.</p>;
  const known = songs.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const unknown = songs.some((s) => s.durationMs === null);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="m-0 font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase" data-testid="picks-header">
        Your picks · {songs.length} {songs.length === 1 ? "song" : "songs"}
        {known > 0 ? ` · ${unknown ? "at least " : ""}${formatDuration(known)}` : ""}
      </p>
    <ul aria-label="Songs you picked" className="m-0 list-none divide-y divide-border border-2 border-rule bg-card p-0 text-sm">
      {songs.map((song) => (
        <li key={song.key} className="flex items-center gap-3 px-3 py-1.5">
          <SongCover image={song.image} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{song.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{[song.artist, song.album].filter(Boolean).join(" · ")}</span>
          </span>
          {song.own && <Badge variant="solid">Your song</Badge>}
          {song.key.startsWith("typed:") && <Badge variant="neutral">Typed</Badge>}
          {song.durationMs !== null && <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatDuration(song.durationMs)}</span>}
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${song.title}`} onClick={() => onRemove(song)}>
            <XIcon aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
    </div>
  );
}

/**
 * "Songs you can play": search Spotify and pick, load your own songs from your Spotify artist link (on Enter, or when you leave
 * the field), or add one the search doesn't have as the search's last row ("Add “…” as typed"). The picks sit in a list with
 * their lengths. Songs by the artists you sound like come first in the search.
 */
export function RepertoirePicker({
  artists,
  picked,
  setPicked,
  errorId,
  error,
}: {
  artists: PickedArtist[];
  picked: PickedSong[];
  setPicked: Dispatch<SetStateAction<PickedSong[]>>;
  errorId?: string;
  /** The field's error, shown under the list. */
  error?: string | null;
}) {
  const [spotifyLink, setSpotifyLink] = useState("");
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The value last sent: the same link is never loaded twice (Enter, then blur).
  const tried = useRef("");
  const linkId = useId();

  function addSongs(next: PickedSong[]) {
    setPicked((current) => [...current, ...next.filter((song) => !current.some((c) => c.key === song.key))].slice(0, MAX_PICKED));
  }

  async function loadOwnSongs() {
    const link = spotifyLink.trim();
    if (!link || link === tried.current || loading) return;
    tried.current = link;
    setSearchNote(null);
    if (link.length < 10) {
      setLinkError("That isn't a Spotify artist link. It starts with open.spotify.com/artist/.");
      return;
    }
    setLinkError(null);
    setLoading(true);
    const res = await fetch(`/api/repertoire?${new URLSearchParams({ type: "artist", link })}`).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    setLoading(false);
    const tracks: TrackResult[] = body?.tracks ?? [];
    if (!tracks.length) {
      setLinkError(
        res?.status === 429
          ? "Too many searches in a short time. Wait a moment and try again."
          : body?.reason === "not_found"
            ? "Spotify has no artist at that link. Open it in Spotify to check it, then copy the artist's share link again."
            : body?.mode === "fallback"
              ? "Spotify isn't answering right now. Try again in a minute, or search for your songs above."
              : "Couldn't load songs from that link. Paste an open.spotify.com/artist/… link, or search for your songs above.",
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

  /** A song typed by hand: kept in the same shape as a picked one (no album, cover or length), so the plan request is the same. */
  function addTyped(song: { title: string; artist: string; own: boolean }) {
    const key = `typed:${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
    addSongs([{ key, title: song.title, artist: song.artist, album: null, image: null, durationMs: null, own: song.own }]);
  }

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1 p-0 text-label font-bold">Songs you can play</legend>
      <SongSearch onAdd={(track) => addSongs([toPicked(track, false)])} isAdded={(track) => picked.some((p) => p.key === track.id)} artists={artists} onAddTyped={addTyped} />
      <PickedSongs songs={picked} onRemove={(song) => setPicked((current) => current.filter((p) => p !== song))} />
      <div className="space-y-1">
        <Label htmlFor={linkId}>Your Spotify artist link (optional)</Label>
        <InputGroup className="has-[>[data-align=inline-start]]:[&>input]:pl-10">
          <InputGroupAddon className="pointer-events-none absolute inset-y-0 left-0 z-10 pl-3">
            <MusicIcon aria-hidden="true" className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            id={linkId}
            value={spotifyLink}
            onChange={(e) => {
              setSpotifyLink(e.target.value);
              setLinkError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void loadOwnSongs();
              }
            }}
            onBlur={() => void loadOwnSongs()}
            aria-busy={loading}
            aria-invalid={linkError ? true : undefined}
            aria-describedby={linkError ? `${linkId}-err` : undefined}
            placeholder="open.spotify.com/artist/…"
        />
        </InputGroup>
        <div aria-live="polite">
          {loading ? (
            <FormMessage>
              <Loader2Icon aria-hidden className="inline size-4 animate-spin motion-reduce:animate-none" /> Loading your songs…
            </FormMessage>
          ) : searchNote ? (
            <FormMessage>{searchNote}</FormMessage>
          ) : (
            <FormMessage>Optional: adds your own songs. Press Enter to load them.</FormMessage>
          )}
        </div>
        {linkError ? (
          <FormMessage tone="error" id={`${linkId}-err`} alert={false}>
            {linkError}
          </FormMessage>
        ) : null}
      </div>
      {error ? (
        <FormMessage tone="error" id={errorId} alert={false}>
          {error}
        </FormMessage>
      ) : null}
    </fieldset>
  );
}
