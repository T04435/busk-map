"use client";

import { MusicIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchTracks, type TrackResult } from "@/components/forms/repertoire-api";
import { useLiveSearch } from "@/components/forms/use-live-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDuration, MIN_QUERY_CHARS } from "@/lib/live-search";
import { isByActArtist, rankByActArtists, type ActArtist } from "@/lib/track-rank";

const LABEL = "Search songs on Spotify";

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
      className="space-y-2 rounded-lg border p-3"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <p className="text-sm text-muted-foreground">Not on Spotify? Type it in. It is saved as typed, without a length.</p>
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

/** Album cover, or a music note when Spotify has none. */
export function SongCover({ image, className }: { image: string | null; className?: string }) {
  return (
    <Avatar className={`rounded-md after:rounded-md ${className ?? ""}`}>
      {image && <AvatarImage src={image} alt="" referrerPolicy="no-referrer" className="rounded-md" />}
      <AvatarFallback className="rounded-md">
        <MusicIcon aria-hidden className="size-4" />
      </AvatarFallback>
    </Avatar>
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
  onAddTyped,
}: {
  onAdd: (track: TrackResult) => void;
  isAdded: (track: TrackResult) => boolean;
  artists: readonly ActArtist[];
  /** When Spotify has no match: a "type it in" form under the search, prefilled from the query. Absent: just the note. */
  onAddTyped?: (song: { title: string; artist: string }) => void | Promise<unknown>;
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

  const noMatch = state.status === "done" && results.length === 0 && Boolean(typed);
  return (
    <div className="space-y-2">
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
              No songs on Spotify match “{state.query}”.{onAddTyped ? " Type it in below instead." : ""}
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
                      <span className="block truncate font-medium">{track.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[artist, track.album].filter(Boolean).join(" · ")}</span>
                    </span>
                    {isByActArtist(track, artists) && <Badge variant="secondary">By your artist</Badge>}
                    {track.durationMs !== null && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(track.durationMs)}</span>}
                    <span className="sr-only">{added ? "Added" : "Add"}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {state.status === "done" && state.note && <p className="px-3 py-1 text-xs text-muted-foreground">{state.note}</p>}
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
