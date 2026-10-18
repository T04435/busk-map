"use client";

import { useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { FormMessage } from "@/components/honeycomb/form-message";
import { Icon } from "@/components/honeycomb/icon";
import { IconAction } from "@/components/honeycomb/icon-action";
import { Loader } from "@/components/honeycomb/loader";
import { SongActions } from "@/components/honeycomb/song-actions";
import { SongRow } from "@/components/honeycomb/song-row";
import { SongTag } from "@/components/honeycomb/song-tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { formatDuration } from "@/lib/live-search";
import { type PickedArtist } from "./artist-picker";
import { SongSearch } from "./song-search";

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

/** One picked song. A typed one can be edited in place: the title and artist become two fields until Done. */
function PickedRow({ song, ownerImage, onRemove, onEdit }: { song: PickedSong; ownerImage?: string; onRemove: (song: PickedSong) => void; onEdit?: (song: PickedSong, edit: { title: string; artist: string }) => void }) {
  const typed = song.key.startsWith("typed:");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const editRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const done = () => {
    const t = clean(title);
    if (t) onEdit?.(song, { title: t, artist: clean(artist) || "Unknown artist" });
    else setTitle(song.title);
    setEditing(false);
    // The row may be re-keyed by the edit: focus returns to the edit button of whichever row renders next.
    queueMicrotask(() => document.querySelector<HTMLButtonElement>(`[data-edit-for="${CSS.escape(t ? `typed:${t.toLowerCase()}|${(clean(artist) || "Unknown artist").toLowerCase()}` : song.key)}"]`)?.focus());
  };
  if (editing)
    return (
      <li className="flex flex-col gap-2 px-3 py-2" data-testid="typed-song-edit">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-t`}>Title</Label>
            <Input ref={titleRef} id={`${id}-t`} value={title} maxLength={120} autoFocus onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), done())} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-a`}>Artist</Label>
            <Input id={`${id}-a`} value={artist} maxLength={80} onChange={(e) => setArtist(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), done())} />
          </div>
        </div>
        <div>
          <Button type="button" size="sm" onClick={done}>
            <Icon name="check" size={16} strokeWidth={2.5} /> Done
          </Button>
        </div>
      </li>
    );
  return (
    <SongRow
      size="sm"
      title={song.title}
      artist={song.artist}
      album={song.album}
      image={song.image}
      durationMs={song.durationMs}
      own={song.own}
      ownerImage={ownerImage}
      tags={typed ? <SongTag kind="typed" /> : undefined}
      className="px-3"
      actions={
        <>
          {typed && onEdit ? (
            <IconAction
              ref={editRef}
              icon="pencil"
              size="sm"
              data-edit-for={song.key}
              // unify-ok: an aria-label, not visible song text
              label={`Edit ${song.title}`}
              onClick={() => {
                setTitle(song.title);
                setArtist(song.artist);
                setEditing(true);
              }}
            />
          ) : null}
          <SongActions size="sm" title={song.title} onRemove={() => onRemove(song)} />
        </>
      }
    />
  );
}

/** The songs you picked: a cover cell, title, "artist · album", a "Your song" badge, the length and a remove button. */
/** `ownerImage`: the artist photo shown in the "Your song" tag (optional; the tag keeps its icon without it). */
export function PicksList({ songs, ownerImage, onRemove, onEdit }: { songs: PickedSong[]; ownerImage?: string; onRemove: (song: PickedSong) => void; onEdit?: (song: PickedSong, edit: { title: string; artist: string }) => void }) {
  if (songs.length === 0) return <p className="m-0 text-sm text-muted-foreground">Search for songs above.</p>;
  const known = songs.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const unknown = songs.some((s) => s.durationMs === null);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3" data-testid="picks-header">
        <span className="text-[15px] leading-5 font-bold">Your picks</span>
        <span className="font-mono text-sm leading-5 text-muted-foreground">
          {songs.length} {songs.length === 1 ? "song" : "songs"}
          {known > 0 ? ` · ${unknown ? "at least " : ""}${formatDuration(known)}` : ""}
        </span>
      </div>
      <ul aria-label="Songs you picked" className="m-0 list-none divide-y divide-border overflow-hidden border-2 border-rule bg-card p-0 text-sm">
        {songs.map((song) => (
          <PickedRow key={song.key} song={song} ownerImage={ownerImage} onRemove={onRemove} onEdit={onEdit} />
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
  ownerImage,
}: {
  artists: PickedArtist[];
  /** Artist photo for the "Your song" tags. */
  ownerImage?: string;
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
            : body?.reason === "missing_key"
              ? "Adding songs from a Spotify profile isn't available here. Search for your songs above."
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
  function addTyped(song: { title: string; artist: string; own?: boolean }) {
    const key = `typed:${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
    addSongs([{ key, title: song.title, artist: song.artist, album: null, image: null, durationMs: null, own: song.own ?? false }]);
  }

  /** Edit a typed song in place: same row, new title and artist (its key follows them, so a duplicate collapses into the other row). */
  function editTyped(song: PickedSong, edit: { title: string; artist: string }) {
    const key = `typed:${edit.title.toLowerCase()}|${edit.artist.toLowerCase()}`;
    setPicked((current) => {
      const next = current.map((p) => (p === song ? { ...p, key, title: edit.title, artist: edit.artist } : p));
      return next.filter((p, i) => next.findIndex((q) => q.key === p.key) === i);
    });
  }

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1 p-0 text-label font-bold">Songs you can play</legend>
      <SongSearch onAdd={(track) => addSongs([toPicked(track, false)])} isAdded={(track) => picked.some((p) => p.key === track.id)} artists={artists} onAddTyped={addTyped} />
      <PicksList songs={picked} ownerImage={ownerImage} onRemove={(song) => setPicked((current) => current.filter((p) => p !== song))} onEdit={editTyped} />
      <div className="space-y-1">
        <Label htmlFor={linkId}>Your Spotify artist link (optional)</Label>
        <InputGroup className="has-[>[data-align=inline-start]]:[&>input]:pl-10">
          <InputGroupAddon className="pointer-events-none absolute inset-y-0 left-0 z-10 pl-3">
            <Icon name="spotify" size={16} />
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
              <Loader size={16} label="Loading" className="mr-1 inline-block align-middle text-primary" /> Loading your songs…
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
