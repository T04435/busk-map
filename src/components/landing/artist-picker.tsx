"use client";

import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { loadListeners, loadReleases, searchArtists, type ArtistResult } from "@/components/forms/repertoire-api";
import { useLiveSearch } from "@/components/forms/use-live-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatCount, MIN_QUERY_CHARS } from "@/lib/live-search";

/** An artist chip: picked from Spotify (with its id), or typed as free text (id null). */
export type PickedArtist = { name: string; spotifyId: string | null; image: string | null };

export const MAX_PICKED_ARTISTS = 10;
const LABEL = "Artists you sound like";
// "|" and "~" separate values in the plan URL.
const clean = (s: string) => s.replace(/[|~]/g, " ").replace(/\s+/g, " ").trim();
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Split typed text into artist names: commas and new lines separate them. */
export function typedArtists(text: string): string[] {
  return text.split(/[,\n]/).map(clean).filter(Boolean);
}

type Props = {
  value: PickedArtist[];
  onChange: (value: PickedArtist[]) => void;
  /** The text in the search box; whatever is left there on submit counts as typed artists. */
  query: string;
  onQueryChange: (query: string) => void;
};

/** "Artists you sound like": a multi-select chip picker over live Spotify search, with free text as a fallback. */
export function ArtistPicker({ value, onChange, query, onQueryChange }: Props) {
  const { state, update, cancel } = useLiveSearch<ArtistResult>(searchArtists);
  const [listeners, setListeners] = useState<Record<string, number | null>>({});
  const [releases, setReleases] = useState<Record<string, number>>({});

  // Release counts (Spotify) and listener counts (Last.fm) load after the results show, never blocking them.
  useEffect(() => {
    if (state.status !== "done" || state.results.length === 0) return;
    const controller = new AbortController();
    const keep = <V,>(set: (update: (current: Record<string, V>) => Record<string, V>) => void) => (counts: Record<string, V>) => {
      if (!controller.signal.aborted) set((current) => ({ ...current, ...counts }));
    };
    loadReleases(state.results.map((a) => a.id), controller.signal).then(keep(setReleases), () => {});
    loadListeners(state.results.map((a) => a.name), controller.signal).then(keep(setListeners), () => {});
    return () => controller.abort();
  }, [state]);

  const has = (name: string) => value.some((a) => a.name.toLowerCase() === name.toLowerCase());
  const full = value.length >= MAX_PICKED_ARTISTS;

  function add(artists: PickedArtist[]) {
    const next = [...value];
    for (const artist of artists) {
      if (next.length >= MAX_PICKED_ARTISTS) break;
      const existing = next.findIndex((a) => a.name.toLowerCase() === artist.name.toLowerCase());
      // A Spotify pick upgrades a typed chip of the same name.
      if (existing === -1) next.push(artist);
      else if (!next[existing].spotifyId && artist.spotifyId) next[existing] = artist;
    }
    onChange(next);
  }

  function setQuery(text: string) {
    // Commas finish a typed chip; the text after the last one stays in the box.
    if (/[,\n]/.test(text)) {
      const parts = text.split(/[,\n]/);
      const rest = parts.pop() ?? "";
      add(parts.map(clean).filter(Boolean).map((name) => ({ name, spotifyId: null, image: null })));
      text = rest.trimStart();
    }
    onQueryChange(text);
    update(text);
  }

  function pick(artist: PickedArtist) {
    add([artist]);
    cancel();
    onQueryChange("");
    update("");
  }

  const typed = clean(query);
  const results = state.status === "done" ? state.results : [];
  // Keyboard focus starts on the first result each time new results arrive.
  const [active, setActive] = useState<{ query: string; value: string } | null>(null);
  const activeValue = active && active.query === state.query && state.status === "done" ? active.value : results[0] ? `spotify:${results[0].id}` : "typed";

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" aria-hidden>
        {LABEL}
      </p>
      {value.length > 0 && (
        <ul aria-label="Artists you picked" className="flex flex-wrap gap-1.5">
          {value.map((artist) => (
            <li key={artist.name}>
              <Badge variant="secondary" className="h-7 gap-1.5 py-0 pr-0.5 pl-0.5 text-sm font-normal">
                <Avatar size="sm">
                  {artist.image && <AvatarImage src={artist.image} alt="" referrerPolicy="no-referrer" />}
                  <AvatarFallback>{initials(artist.name)}</AvatarFallback>
                </Avatar>
                <span>{artist.name}</span>
                {!artist.spotifyId && <span className="text-xs text-muted-foreground">(typed)</span>}
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${artist.name}`} onClick={() => onChange(value.filter((a) => a !== artist))}>
                  <XIcon aria-hidden />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Command
        shouldFilter={false}
        loop
        label={LABEL}
        className="h-auto border"
        value={activeValue}
        onValueChange={(value) => setActive({ query: state.query, value })}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={full ? `Up to ${MAX_PICKED_ARTISTS} artists` : "Search Spotify, e.g. Paul Kelly"}
          disabled={full}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && query === "" && value.length > 0) onChange(value.slice(0, -1));
            if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            }
          }}
        />
        {typed && (
          <CommandList label="Artist results">
            {state.status === "idle" && typed.length < MIN_QUERY_CHARS && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Type {MIN_QUERY_CHARS} or more letters to search Spotify.</p>
            )}
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
                No artists on Spotify match “{state.query}”.
              </p>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Spotify">
                {results.map((artist) => {
                  const count = listeners[artist.name];
                  const released = releases[artist.id] ?? artist.releases;
                  const meta = [
                    typeof released === "number" ? `${released} release${released === 1 ? "" : "s"}` : null,
                    typeof count === "number" ? `${formatCount(count)} Last.fm listeners` : null,
                  ].filter(Boolean);
                  return (
                    <CommandItem
                      key={artist.id}
                      value={`spotify:${artist.id}`}
                      data-checked={has(artist.name)}
                      onSelect={() => pick({ name: clean(artist.name), spotifyId: artist.id, image: artist.image })}
                    >
                      <Avatar>
                        {artist.image && <AvatarImage src={artist.image} alt="" referrerPolicy="no-referrer" />}
                        <AvatarFallback>{initials(artist.name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{artist.name}</span>
                        {meta.length > 0 && <span className="block text-xs text-muted-foreground">{meta.join(" · ")}</span>}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {state.status === "done" && state.note && <p className="px-3 py-1 text-xs text-muted-foreground">{state.note}</p>}
            {!has(typed) && (
              <CommandGroup heading="Not on Spotify?">
                <CommandItem value="typed" onSelect={() => pick({ name: typed, spotifyId: null, image: null })}>
                  Add “{typed}” as typed
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
