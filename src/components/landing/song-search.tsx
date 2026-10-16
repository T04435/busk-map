"use client";

import { MusicIcon, PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchTracks, type TrackResult } from "@/components/forms/repertoire-api";
import { useLiveSearch } from "@/components/forms/use-live-search";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Badge } from "@/components/ui/badge";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDuration, MIN_QUERY_CHARS } from "@/lib/live-search";
import { isByActArtist, rankByActArtists, type ActArtist } from "@/lib/track-rank";

const LABEL = "Search songs on Spotify";

/** Album cover in a honeycomb cell, or a music note when Spotify has none. */
export function SongCover({ image, className, size = 32 }: { image: string | null; className?: string; size?: number }) {
  return (
    <HexCell size={size} tone="muted" image={image} className={className}>
      <MusicIcon aria-hidden className="size-4" />
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
  /** A song typed by hand, for the ones Spotify doesn't have: the last row of the list (F25). */
  onAddTyped?: (song: { title: string; artist: string; own: boolean }) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
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

  return (
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
          {state.status === "idle" && <p className="px-3 py-2 text-sm text-muted-foreground">Type {MIN_QUERY_CHARS} or more letters to search Spotify.</p>}
          {state.status === "loading" && (
            <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
              Searching Spotify…
            </p>
          )}
          {state.status === "error" && (
            <p role="alert" className="px-3 py-2 text-sm text-destructive">
              {state.message}
            </p>
          )}
          {state.status === "done" && results.length === 0 && (
            <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
              No songs on Spotify match “{state.query}”.
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
                    <SongCover image={track.image} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{track.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[artist, track.album].filter(Boolean).join(" · ")}</span>
                      {isByActArtist(track, artists) && (
                        <span className="mt-0.5 block">
                          <Badge variant="neutral">By your artist</Badge>
                        </span>
                      )}
                    </span>
                    {track.durationMs !== null && <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatDuration(track.durationMs)}</span>}
                    <span className={added ? "font-mono text-[11px] leading-4 font-bold tracking-[0.06em] uppercase" : "sr-only"}>{added ? "Added" : "Add"}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {state.status === "done" && state.note && <p className="px-3 py-1 text-xs text-muted-foreground">{state.note}</p>}
          {onAddTyped && (
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
                <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 break-words">
                  Add “{parsedTyped.title}”{parsedTyped.artist ? ` by ${parsedTyped.artist}` : ""} as typed
                </span>
              </CommandItem>
              <p className="m-0 px-3 pb-2 text-xs text-muted-foreground">It&apos;s saved without a length, tagged Typed. Edit the title or artist any time.</p>
            </CommandGroup>
          )}
        </CommandList>
      )}
    </Command>
  );
}
