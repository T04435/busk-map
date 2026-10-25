"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "cn";
import { loadListeners, loadReleases, searchArtists, type ArtistResult } from "@/components/forms/repertoire-api";
import { useLiveSearch } from "@/components/forms/use-live-search";
import { ArtistChip } from "@/components/honeycomb/artist-chip";
import { Icon } from "@/components/honeycomb/icon";
import { Spinner } from "@/components/ui/spinner";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatCount, MIN_QUERY_CHARS } from "@/lib/live-search";
import { SPOTIFY_ARTIST_URL } from "@/lib/mention";
import { looksLikeLink } from "@/lib/spotify-link";

/** An artist chip: picked from Spotify (with its id), suggested by Qloo (qlooId, and a spotifyId when Qloo has one), or typed as free text (both null). */
export type PickedArtist = { name: string; spotifyId: string | null; image: string | null; qlooId?: string | null };

/** Where a chip came from: Spotify's search, Qloo's suggestions (no Spotify id), or typed text. */
export const artistSource = (artist: Pick<PickedArtist, "spotifyId" | "qlooId">): "spotify" | "qloo" | "typed" => (artist.spotifyId ? "spotify" : artist.qlooId ? "qloo" : "typed");

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
  /** The section around it already says "Artists you sound like" (/repertoire, U28): no second visible label. */
  hideLabel?: boolean;
  /**
   * "single": one Spotify artist (the act itself, /repertoire). A pick replaces the value and the field gives way to its chip;
   * no typed names; a pasted link or spotify: URI stays in the box unsearched, and Enter then submits the surrounding form.
   */
  mode?: "multi" | "single";
  /** The field's label (default "Artists you sound like"). */
  label?: string;
  placeholder?: string;
  /** Marks the search box for focus management (`data-focus-id`). */
  focusId?: string;
  disabled?: boolean;
};

/**
 * "Artists you sound like": a multi-select chip picker over live Spotify search, with free text as a fallback.
 * In single mode, the one-artist lookup for the act's own Spotify artist.
 */
export function ArtistPicker({ value, onChange, query, onQueryChange, hideLabel = false, mode = "multi", label = LABEL, placeholder, focusId, disabled = false }: Props) {
  const single = mode === "single";
  const { state, update, cancel } = useLiveSearch<ArtistResult>(searchArtists);
  const [listeners, setListeners] = useState<Record<string, number | null>>({});
  const [releases, setReleases] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const chipsRef = useRef<HTMLUListElement>(null);
  const refocus = useRef<"input" | "chip" | null>(null);

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
  const full = value.length >= (single ? 1 : MAX_PICKED_ARTISTS);

  function add(artists: PickedArtist[]) {
    const next = [...value];
    for (const artist of artists) {
      if (next.length >= MAX_PICKED_ARTISTS) break;
      const existing = next.findIndex((a) => a.name.toLowerCase() === artist.name.toLowerCase());
      // A Spotify pick upgrades a typed chip of the same name.
      if (existing === -1) next.push(artist);
      else if (!next[existing].spotifyId && artist.spotifyId) next[existing] = { ...artist, qlooId: artist.qlooId ?? next[existing].qlooId ?? null };
    }
    onChange(next);
  }

  function setQuery(text: string) {
    if (single) {
      onQueryChange(text);
      // A pasted link is the answer itself: nothing to search for.
      update(looksLikeLink(text) ? "" : text);
      return;
    }
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
    if (single) {
      refocus.current = "chip";
      onChange([artist]);
    }
    else add([artist]);
    cancel();
    onQueryChange("");
    update("");
    // The list closes and the search box keeps focus, so the next artist can be searched straight away.
    if (!single) inputRef.current?.focus();
  }

  // Single mode: the box and the chip take turns, so focus follows: a pick lands on the chip, removing it back in the box.
  useEffect(() => {
    const target = refocus.current;
    refocus.current = null;
    if (target === "input") inputRef.current?.focus();
    if (target === "chip") chipsRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [value]);

  const typed = single && looksLikeLink(query) ? "" : clean(query);
  const results = state.status === "done" ? state.results : [];
  // The listbox exists only while it has options: Spotify results, or the "add as typed" row.
  const offerTyped = !single && !has(typed);
  const listed = results.length > 0 || offerTyped;
  // Keyboard focus starts on the first result each time new results arrive.
  const [active, setActive] = useState<{ query: string; value: string } | null>(null);
  const activeValue = active && active.query === state.query && state.status === "done" ? active.value : results[0] ? `spotify:${results[0].id}` : offerTyped ? "typed" : "";

  return (
    <div className="space-y-2">
      {hideLabel ? null : (
        <p className="text-label font-bold" aria-hidden>
          {label}
        </p>
      )}
      {value.length > 0 && (
        <ul ref={chipsRef} aria-label={single ? label : "Artists you picked"} className="m-0 flex list-none flex-col items-stretch gap-2 p-0">
          {value.map((artist) => (
            <li key={artist.name}>
              <ArtistChip
                name={artist.name}
                image={artist.image}
                href={artist.spotifyId ? SPOTIFY_ARTIST_URL(artist.spotifyId) : undefined}
                source={artistSource(artist) === "spotify" ? undefined : artistSource(artist)}
                state="picked"
                onRemove={() => {
                  refocus.current = single ? "input" : null;
                  onChange(value.filter((a) => a !== artist));
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {single && full ? null : (
      <Command
        shouldFilter={false}
        loop
        label={label}
        className="h-auto gap-1 overflow-visible border-0 bg-transparent p-0"
        value={activeValue}
        onValueChange={(value) => setActive({ query: state.query, value })}
      >
        <CommandInput
          ref={inputRef}
          expanded={Boolean(typed) && listed}
          value={query}
          onValueChange={setQuery}
          placeholder={placeholder ?? (full ? `Up to ${MAX_PICKED_ARTISTS} artists` : "Search Spotify, e.g. Paul Kelly")}
          disabled={full || disabled}
          aria-describedby={single ? undefined : hintId}
          data-focus-id={focusId}
          onKeyDown={(e) => {
            // Single mode: with no list to pick from (a pasted link), Enter submits the form, as a plain field would.
            if (single && e.key === "Enter" && (looksLikeLink(query) || !query.trim())) e.currentTarget.form?.requestSubmit();
            if (e.key === "Backspace" && query === "" && value.length > 0) onChange(value.slice(0, -1));
            if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            }
          }}
        />
        {single ? null : (
          <p id={hintId} className="m-0 text-sm leading-5 text-muted-foreground" data-testid="artists-hint">
            {full ? "That’s the most. Remove one to add another." : `${value.length} of ${MAX_PICKED_ARTISTS}. Type a comma to add a name that isn’t on Spotify.`}
          </p>
        )}
        {typed && (
          <div className="border-2 border-rule bg-popover p-1">
            {/* Status lines sit beside the list, never inside it: a listbox holds only options (and groups of them). */}
            {state.status === "idle" && typed.length < MIN_QUERY_CHARS && (
              <p className={LINE}>Type {MIN_QUERY_CHARS} or more letters to search Spotify.</p>
            )}
            {state.status === "loading" && (
              <p role="status" className={LINE}>
                <Spinner size={18} label="Searching" className="text-primary" />
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
            {state.status === "done" && state.note && <p className="px-3 py-1 text-xs text-muted-foreground">{state.note}</p>}
            {listed && (
              <CommandList label="Artist results">
                {results.length > 0 && (
                  <CommandGroup heading="Spotify">
                    {results.map((artist) => {
                      const count = listeners[artist.name];
                      const released = releases[artist.id] ?? artist.releases;
                      const meta = [
                        typeof released === "number" ? `${released} release${released === 1 ? "" : "s"}` : null,
                      ].filter(Boolean);
                      return (
                        <CommandItem
                          key={artist.id}
                          value={`spotify:${artist.id}`}
                          data-checked={has(artist.name)}
                          onSelect={() => pick({ name: clean(artist.name), spotifyId: artist.id, image: artist.image })}
                        >
                          <ArtistChip
                            name={artist.name}
                            image={artist.image}
                            href={SPOTIFY_ARTIST_URL(artist.id)}
                            tags={meta as string[]}
                            state={has(artist.name) ? "added" : "static"}
                            interactive={false}
                            className="min-w-0 flex-1 border-0"
                          />
                          {typeof count === "number" && (
                            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                              <SourceLogo source="lastfm" height={14} />
                              {formatCount(count)} listeners
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
                {offerTyped && (
                  <CommandGroup heading="Not on Spotify?">
                    <CommandItem value="typed" onSelect={() => pick({ name: typed, spotifyId: null, image: null })}>
                      <Icon name="plus" size={18} />
                      <span className="min-w-0 flex-1 break-words">Add “{typed}” as typed</span>
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            )}
          </div>
        )}
      </Command>
      )}
    </div>
  );
}
