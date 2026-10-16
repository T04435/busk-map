"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "cn";
import { loadListeners, loadReleases, searchArtists, type ArtistResult } from "@/components/forms/repertoire-api";
import { useLiveSearch } from "@/components/forms/use-live-search";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { Loader } from "@/components/honeycomb/loader";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatCount, MIN_QUERY_CHARS } from "@/lib/live-search";

/** An artist chip: picked from Spotify (with its id), or typed as free text (id null). */
export type PickedArtist = { name: string; spotifyId: string | null; image: string | null };

export const MAX_PICKED_ARTISTS = 10;
const LABEL = "Artists you sound like";
// A status line in the results frame (DS bm-results-line).
const LINE = "m-0 flex items-center gap-2 p-3 text-sm leading-5 text-muted-foreground";
// "|" and "~" separate values in the plan URL.
const clean = (s: string) => s.replace(/[|~]/g, " ").replace(/\s+/g, " ").trim();

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
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();

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
    // The list closes and the search box keeps focus, so the next artist can be searched straight away.
    inputRef.current?.focus();
  }

  const typed = clean(query);
  const results = state.status === "done" ? state.results : [];
  // Keyboard focus starts on the first result each time new results arrive.
  const [active, setActive] = useState<{ query: string; value: string } | null>(null);
  const activeValue = active && active.query === state.query && state.status === "done" ? active.value : results[0] ? `spotify:${results[0].id}` : "typed";

  return (
    <div className="space-y-2">
      <p className="text-label font-bold" aria-hidden>
        {LABEL}
      </p>
      {value.length > 0 && (
        <ul aria-label="Artists you picked" className="m-0 flex list-none flex-col items-stretch gap-2 p-0">
          {value.map((artist) => (
            <li key={artist.name} className="box-border flex h-control w-full max-w-full items-center gap-2 border-2 border-rule bg-card pl-1.5 text-sm leading-5">
              <HexCell size={26} image={artist.image} fontSize={11}>
                {initialsOf(artist.name)}
              </HexCell>
              <span className="min-w-0 flex-1 truncate font-bold" title={artist.name}>
                {artist.name}
              </span>
              {!artist.spotifyId && <span className="shrink-0 font-mono text-[11px] leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase">Typed</span>}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-full w-10 shrink-0 rounded-none border-0 border-l border-border"
                aria-label={`Remove ${artist.name}`}
                onClick={() => onChange(value.filter((a) => a !== artist))}
              >
                <Icon name="x" size={16} strokeWidth={2.5} />
              </Button>
            </li>
          ))}
        </ul>
      )}
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
          onValueChange={setQuery}
          placeholder={full ? `Up to ${MAX_PICKED_ARTISTS} artists` : "Search Spotify, e.g. Paul Kelly"}
          disabled={full}
          aria-describedby={hintId}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && query === "" && value.length > 0) onChange(value.slice(0, -1));
            if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            }
          }}
        />
        <p id={hintId} className="m-0 text-sm leading-5 text-muted-foreground" data-testid="artists-hint">
          {full ? "That’s the most. Remove one to add another." : `${value.length} of ${MAX_PICKED_ARTISTS}. Type a comma to add a name that isn’t on Spotify.`}
        </p>
        {typed && (
          <CommandList label="Artist results" className="border-2 border-rule bg-popover p-1">
            {state.status === "idle" && typed.length < MIN_QUERY_CHARS && (
              <p className={LINE}>Type {MIN_QUERY_CHARS} or more letters to search Spotify.</p>
            )}
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
                      <HexCell size={32} image={artist.image} fontSize={12}>
                        {initialsOf(artist.name)}
                      </HexCell>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{artist.name}</span>
                        {meta.length > 0 && <span className="block font-mono text-xs text-muted-foreground">{meta.join(" · ")}</span>}
                      </span>
                      {has(artist.name) && <span className="font-mono text-[11px] leading-4 font-bold tracking-[0.06em] uppercase">Added</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {state.status === "done" && state.note && <p className="px-3 py-1 text-xs text-muted-foreground">{state.note}</p>}
            {!has(typed) && (
              <CommandGroup heading="Not on Spotify?">
                <CommandItem value="typed" onSelect={() => pick({ name: typed, spotifyId: null, image: null })}>
                  <Icon name="plus" size={18} />
                  <span className="min-w-0 flex-1 break-words">Add “{typed}” as typed</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
