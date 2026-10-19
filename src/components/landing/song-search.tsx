"use client";

import { useEffect, useRef, useState } from "react";
import { searchTracks, type TrackResult } from "@/components/forms/repertoire-api";
import { useLiveSearch } from "@/components/forms/use-live-search";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { Loader } from "@/components/honeycomb/loader";
import { SongRow } from "@/components/honeycomb/song-row";
import { SPOTIFY_ARTIST_URL } from "@/lib/mention";
import { SongTag } from "@/components/honeycomb/song-tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "cn";
import { MIN_QUERY_CHARS } from "@/lib/live-search";
import { isByActArtist, rankByActArtists, type ActArtist } from "@/lib/track-rank";

const LABEL = "Search songs on Spotify";
// A status line in the results frame (DS bm-results-line).
const LINE = "m-0 flex items-center gap-2 p-3 text-sm leading-5 text-muted-foreground";

/** "Title - Artist" from what was searched: the song typed in when Spotify has no match, prefilled (artist empty when there is no " - "). */
export function splitTypedQuery(query: string): { title: string; artist: string } {
  const [title, ...rest] = query.trim().split(/\s+[-–]\s+/);
  return { title: title.trim(), artist: rest.join(" - ").trim() };
}

/** Spotify has no match: type the song in, prefilled from the search. It is added as typed (no length, no cover). */
function TypedFallback({ query, onAdd }: { query: string; onAdd: (song: { title: string; artist: string }) => void | Promise<unknown> }) {
  const initial = splitTypedQuery(query);
  const [title, setTitle] = useState(initial.title);
  const [artist, setArtist] = useState(initial.artist);
  const [busy, setBusy] = useState(false);
  // Not a <form>: this sits inside the busk form, and a nested form's submit would plan the busk.
  async function submit() {
    if (!title.trim() || !artist.trim()) return;
    setBusy(true);
    try {
      await onAdd({ title: title.trim(), artist: artist.trim() });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      role="group"
      aria-label="Type in a song"
      data-testid="type-it-in"
      className="flex flex-col gap-2 border-2 border-dashed border-border bg-card p-3"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <p className="m-0 text-sm text-muted-foreground">Not on Spotify? Type it in.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="typed-title">Song title</Label>
          <Input id="typed-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoComplete="off" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="typed-artist">Artist</Label>
          <Input id="typed-artist" value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={80} autoComplete="off" />
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={busy || !title.trim() || !artist.trim()} onClick={() => void submit()}>
        Add as typed
      </Button>
    </div>
  );
}

/** Album cover in a honeycomb cell, or a music note when Spotify has none. */
export function SongCover({ image, className, size = 32 }: { image: string | null; className?: string; size?: number }) {
  return (
    <HexCell size={size} tone="muted" image={image} className={className}>
      <Icon name="music" size={16} />
    </HexCell>
  );
}

/**
 * "Songs you can play": live Spotify song search. Picking a result adds it (cover, album and length kept).
 * Songs by the act's "sounds like" artists (`artists`) come first, marked "By your artist".
 */
/** What was typed as a song: "Title - Artist", with "(own)" at the end for your own song. No " - " means a title only (artist ""). */
export function parseTypedSong(text: string): { title: string; artist: string; own: boolean } {
  const own = /\(own\)\s*$/i.test(text);
  const body = text.replace(/\(own\)\s*$/i, "").trim();
  const [title, ...rest] = body.split(/\s+[-–]\s+/);
  const clean = (s: string) => s.replace(/[|~]/g, " ").trim();
  // A title with no " - " has no artist: the row says so by leaving "by <artist>" off, and the song is saved as "Unknown artist".
  return { title: clean(title), artist: clean(rest.join(" - ")), own };
}

export function SongSearch({
  onAdd,
  isAdded,
  artists,
  onAddTyped,
}: {
  onAdd: (track: TrackResult) => void;
  isAdded: (track: TrackResult) => boolean;
  artists: readonly ActArtist[];
  /**
   * A song typed by hand, for the ones Spotify doesn't have: when Spotify has no match, a "type it in" form under the search,
   * prefilled from the query; when it has matches, the list's last row ("Add “…” as typed", F25). Absent: just the note.
   */
  onAddTyped?: (song: { title: string; artist: string; own?: boolean }) => void | Promise<unknown>;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  /** The photo of the act's artist who made the track, when picked with one: the cover's second choice (U03). */
  const artistPhoto = (track: TrackResult) => artists.find((a) => a.image && isByActArtist(track, [a]))?.image ?? undefined;
  // The search function is read once (useLiveSearch), so it reads the current chips from a ref.
  const artistsRef = useRef(artists);
  useEffect(() => {
    artistsRef.current = artists;
  }, [artists]);
  const [search] = useState(() => (q: string, signal: AbortSignal) => searchTracks(q, signal, artistsRef.current.map((a) => a.name)));
  const { state, update } = useLiveSearch<TrackResult>(search);
  const typed = query.trim();
  const parsedTyped = parseTypedSong(typed);
  // Ranked again here with Spotify ids, and for chips added after the search.
  const results = state.status === "done" ? rankByActArtists(state.results, artists) : [];
  // Keyboard focus starts on the first result each time new results arrive.
  const [active, setActive] = useState<{ query: string; value: string } | null>(null);
  const activeValue = active && active.query === state.query && state.status === "done" ? active.value : results[0] ? `spotify:${results[0].id}` : "typed";

  const noMatch = state.status === "done" && results.length === 0 && Boolean(typed);
  return (
    <div className="space-y-2">
    <Command
      shouldFilter={false}
      loop
      label={LABEL}
      className="h-auto gap-1 overflow-visible border-0 bg-transparent p-0"
      value={activeValue}
      onValueChange={(value) => setActive({ query: state.query, value })}
    >
      <CommandInput
        ref={inputRef}
        expanded={Boolean(typed)}
        value={query}
        onValueChange={(text) => {
          setQuery(text);
          update(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            e.preventDefault();
            setQuery("");
            update("");
          }
        }}
        placeholder="Search songs, e.g. Riptide"
      />
      {typed && (
        <CommandList label="Song results" className="max-h-80 border-2 border-rule bg-popover p-1">
          {state.status === "idle" && <p className={LINE}>Type {MIN_QUERY_CHARS} or more letters to search Spotify.</p>}
          {state.status === "loading" && (
            <p role="status" className={LINE}>
              <Loader size={18} label="Searching" className="text-primary" />
              Searching Spotify…
            </p>
          )}
          {state.status === "error" && (
            <p role="alert" className={cn(LINE, "text-destructive")}>
              <Icon name="warning" size={16} className="shrink-0" />
              {state.message}
            </p>
          )}
          {state.status === "done" && results.length === 0 && (
            <p role="status" className={LINE}>
              No songs on Spotify match “{state.query}”.{onAddTyped ? " Type it in below instead." : ""}
            </p>
          )}
          {results.length > 0 && (
            <CommandGroup heading="Spotify">
              {results.map((track) => {
                const artist = track.artists.map((a) => a.name).join(", ");
                const added = isAdded(track);
                return (
                  <CommandItem key={track.id} value={`spotify:${track.id}`} data-checked={added} onSelect={() => {
                      if (added) return;
                      onAdd(track);
                      // B-036: the list closes and the search box stays focused (cleared) for the next song.
                      setQuery("");
                      update("");
                      inputRef.current?.focus();
                    }}
                  >
                    <SongRow
                      interactive={false}
                      size="sm"
                      title={track.title}
                      artist={artist}
                      album={track.album}
                      image={track.image}
                      artistImage={artistPhoto(track)}
                      artistHref={track.artists[0]?.id && /^[A-Za-z0-9]{22}$/.test(track.artists[0].id) ? SPOTIFY_ARTIST_URL(track.artists[0].id) : undefined}
                      source="spotify"
                      durationMs={track.durationMs}
                      className="w-full py-0"
                      tags={
                        <>
                          {isByActArtist(track, artists) && <SongTag kind="by-your-artist" />}
                          {added && <SongTag kind="added" />}
                        </>
                      }
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {state.status === "done" && state.note && <p className="px-3 py-1 text-xs text-muted-foreground">{state.note}</p>}
          {onAddTyped && results.length > 0 && (
            <CommandGroup heading="Not on Spotify?">
              <CommandItem
                value="typed"
                onSelect={() => {
                  onAddTyped({ ...parsedTyped, artist: parsedTyped.artist || "Unknown artist" });
                  setQuery("");
                  update("");
                  inputRef.current?.focus();
                }}
              >
                <Icon name="plus" size={18} />
                <span className="min-w-0 flex-1 break-words">
                  Add “{parsedTyped.title}”{parsedTyped.artist ? ` by ${parsedTyped.artist}` : ""} as typed
                </span>
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      )}
    </Command>
    {noMatch && onAddTyped && (
      <TypedFallback
        key={state.query}
        query={state.query}
        onAdd={async (song) => {
          // A refusal (`false`, e.g. already in the list) keeps what was typed.
          if ((await onAddTyped(song)) === false) return;
          setQuery("");
          update("");
        }}
      />
    )}
    </div>
  );
}
