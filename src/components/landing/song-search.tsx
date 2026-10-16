"use client";

import { MusicIcon } from "lucide-react";
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
export function SongSearch({
  onAdd,
  isAdded,
  artists,
}: {
  onAdd: (track: TrackResult) => void;
  isAdded: (track: TrackResult) => boolean;
  artists: readonly ActArtist[];
}) {
  const [query, setQuery] = useState("");
  // The search function is read once (useLiveSearch), so it reads the current chips from a ref.
  const artistsRef = useRef(artists);
  useEffect(() => {
    artistsRef.current = artists;
  }, [artists]);
  const [search] = useState(() => (q: string, signal: AbortSignal) => searchTracks(q, signal, artistsRef.current.map((a) => a.name)));
  const { state, update } = useLiveSearch<TrackResult>(search);
  const typed = query.trim();
  // Ranked again here with Spotify ids, and for chips added after the search.
  const results = state.status === "done" ? rankByActArtists(state.results, artists) : [];
  // Keyboard focus starts on the first result each time new results arrive.
  const [active, setActive] = useState<{ query: string; value: string } | null>(null);
  const activeValue = active && active.query === state.query && state.status === "done" ? active.value : results[0] ? `spotify:${results[0].id}` : "";

  return (
    <Command
      shouldFilter={false}
      loop
      label={LABEL}
      className="h-auto border"
      value={activeValue}
      onValueChange={(value) => setActive({ query: state.query, value })}
    >
      <CommandInput
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
        <CommandList label="Song results" className="max-h-80">
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
              No songs on Spotify match “{state.query}”. Type it in the song list below instead.
            </p>
          )}
          {results.length > 0 && (
            <CommandGroup heading="Spotify">
              {results.map((track) => {
                const artist = track.artists.map((a) => a.name).join(", ");
                const added = isAdded(track);
                return (
                  <CommandItem key={track.id} value={`spotify:${track.id}`} data-checked={added} onSelect={() => !added && onAdd(track)}>
                    <SongCover image={track.image} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{track.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[artist, track.album].filter(Boolean).join(" · ")}</span>
                    </span>
                    {isByActArtist(track, artists) && <Badge variant="neutral">By your artist</Badge>}
                    {track.durationMs !== null && <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatDuration(track.durationMs)}</span>}
                    <span className={added ? "font-mono text-[11px] leading-4 font-bold tracking-[0.06em] uppercase" : "sr-only"}>{added ? "Added" : "Add"}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {state.status === "done" && state.note && <p className="px-3 py-1 text-xs text-muted-foreground">{state.note}</p>}
        </CommandList>
      )}
    </Command>
  );
}
