"use client";

import { useId, useState } from "react";
import { HIVE_SIZES, HiveMark } from "@/components/honeycomb/hive-mark";
import { modelName } from "@/lib/sources";
import { useLiveSearch } from "@/components/forms/use-live-search";
import { Icon } from "@/components/honeycomb/icon";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { MIN_QUERY_CHARS, SearchError, type SearchOutcome } from "@/lib/live-search";
import { ArtistPicker, typedArtists, type PickedArtist } from "@/components/landing/artist-picker";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MAX_RESEARCH_ARTISTS, MAX_RESEARCH_GENRES, type ResearchSuggest } from "@/lib/repertoire-research";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { ResearchAnswer } from "./learn-api";

const R = PLAYLIST_COPY.research;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

const genreKey = (name: string) => name.trim().toLowerCase();
// A status line beside the list (DS bm-results-line), never inside it: a listbox holds only options.
const LINE = "m-0 flex items-center gap-2 p-3 text-sm leading-5 text-muted-foreground";

/** The broad quick picks: the fixed genres, less any the research or the Hive suggested (those are on the Suggested row). */
export function genreOptions(suggest: ResearchSuggest | null | undefined): string[] {
  const suggested = new Set((suggest?.genres ?? []).map((g) => genreKey(g.name)));
  return R.genrePick.options.filter((o) => !suggested.has(genreKey(o)));
}

/** Genre search (GET /api/genres, Qloo /v2/tags). Module-level: useLiveSearch reads it once. */
export async function searchGenreNames(q: string, signal: AbortSignal): Promise<SearchOutcome<{ id: string; name: string }>> {
  const res = await fetch(`/api/genres?${new URLSearchParams({ q })}`, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new SearchError(body?.error?.message ?? "Genre search isn't working right now. Try again in a moment.");
  if (body?.mode === "fallback") throw new SearchError("Qloo isn't answering right now. Pick a genre below, or try again in a moment.");
  return { results: Array.isArray(body?.genres) ? body.genres : [] };
}

/** Type a genre, pick one of Qloo's: a small typeahead over GET /api/genres. */
function GenreSearch({ picked, onPick, disabled }: { picked: readonly string[]; onPick: (name: string) => void; disabled: boolean }) {
  const { state, update, cancel } = useLiveSearch<{ id: string; name: string }>(searchGenreNames);
  const [query, setQuery] = useState("");
  const typed = query.trim();
  const results = state.status === "done" && state.query === typed ? state.results.filter((g) => !picked.some((p) => genreKey(p) === genreKey(g.name))) : [];
  const [active, setActive] = useState<{ query: string; value: string } | null>(null);
  const activeValue = active && active.query === typed ? active.value : (results[0]?.id ?? "");
  return (
    <Command shouldFilter={false} loop label={R.ask.genreSearch} className="h-auto gap-1 overflow-visible border-0 bg-transparent p-0" value={activeValue} onValueChange={(value) => setActive({ query: typed, value })}>
      <CommandInput
        expanded={Boolean(typed) && results.length > 0}
        value={query}
        onValueChange={(text) => {
          setQuery(text);
          update(text);
        }}
        placeholder={disabled ? `Up to ${MAX_RESEARCH_GENRES} genres` : R.ask.genrePlaceholder}
        disabled={disabled}
        data-testid="research-genre-search"
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            e.preventDefault();
            setQuery("");
            update("");
          }
        }}
      />
      {typed && (
        <div className="border-2 border-rule bg-popover p-1">
          {state.status === "idle" && typed.length < MIN_QUERY_CHARS && <p className={LINE}>Type {MIN_QUERY_CHARS} or more letters to search genres.</p>}
          {state.status === "loading" && (
            <p role="status" className={LINE}>
              <Spinner size={18} label="Searching" className="text-primary" />
              Searching genres…
            </p>
          )}
          {state.status === "error" && (
            <p role="alert" className={LINE}>
              {state.message}
            </p>
          )}
          {state.status === "done" && state.query === typed && results.length === 0 && (
            <p role="status" className={LINE}>
              No genre on Qloo matches “{state.query}”.
            </p>
          )}
          {results.length > 0 && (
            <CommandList label="Genre results">
              <CommandGroup heading="Qloo genres">
                {results.map((g) => (
                  <CommandItem
                    key={g.id}
                    value={g.id}
                    onSelect={() => {
                      onPick(g.name);
                      cancel();
                      setQuery("");
                      update("");
                    }}
                  >
                    {g.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          )}
        </div>
      )}
    </Command>
  );
}

/**
 * Inside the research step that waits (Who you sound like): the Hive's ask, the artist picker and up to three genres. It starts
 * from what the research found (the sound-alikes prefilled, the act's genres selected), so Carry on as it is confirms them; nothing
 * is sent until Carry on.
 */
export function ResearchAsk({ message, busy, onSubmit, suggest }: { message: string; busy: boolean; onSubmit: (answer: ResearchAnswer) => void; suggest?: ResearchSuggest | null }) {
  const [artists, setArtists] = useState<PickedArtist[]>(() => (suggest?.artists ?? []).slice(0, MAX_RESEARCH_ARTISTS).map((a) => ({ name: a.name, spotifyId: a.spotifyId ?? null, image: a.image ?? null })));
  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState<string[]>(() => (suggest?.genres ?? []).filter((g) => g.picked).slice(0, MAX_RESEARCH_GENRES).map((g) => g.name));
  const options = genreOptions(suggest);
  // The Hive's own suggestions (not found by the research) carry its mark.
  const hiveNames = new Set((suggest?.genres ?? []).filter((g) => g.from === "hive").map((g) => genreKey(g.name)));
  const hiveTitle = `${modelName(suggest?.hiveBy, "label")}'s suggestion`;
  const hiveMark = (name: string) => (hiveNames.has(genreKey(name)) ? <HiveMark size={HIVE_SIZES.tag} decorative /> : null);
  const unpicked = (suggest?.genres ?? []).filter((g) => !genres.some((x) => genreKey(x) === genreKey(g.name)));
  const add = (name: string) => setGenres((now) => (now.some((x) => genreKey(x) === genreKey(name)) || now.length >= MAX_RESEARCH_GENRES ? now : [...now, name]));
  const genreLabelId = useId();
  const suggestedId = useId();
  const chosen = () => {
    const list = [...artists];
    for (const typed of typedArtists(query)) if (!list.some((a) => a.name.toLowerCase() === typed.toLowerCase())) list.push({ name: typed, spotifyId: null, image: null });
    return list.slice(0, MAX_RESEARCH_ARTISTS).map((a) => ({ name: a.name, ...(a.spotifyId && SPOTIFY_ID.test(a.spotifyId) ? { spotifyId: a.spotifyId } : {}), ...(a.image && /^https:\/\//.test(a.image) && a.image.length <= 500 ? { image: a.image } : {}) }));
  };
  const ready = artists.length > 0 || typedArtists(query).length > 0 || genres.length > 0;
  const submit = () => {
    if (busy || !ready) return;
    const list = chosen();
    onSubmit({ ...(list.length > 0 ? { artists: list } : {}), ...(genres.length > 0 ? { genres } : {}) });
  };
  return (
    <div className="grid min-w-0 gap-4" data-testid="research-ask">
      <p className="m-0 max-w-prose text-sm leading-5" data-testid="research-ask-line">
        {message}
      </p>
      <form
        className="grid max-w-2xl gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <ArtistPicker value={artists} onChange={setArtists} query={query} onQueryChange={setQuery} />
        <div className="grid gap-2" role="group" aria-labelledby={genreLabelId}>
          <p id={genreLabelId} className="m-0 text-sm font-bold">
            {R.ask.genreLabel}
          </p>
          {genres.length > 0 && (
            <ul aria-label={R.ask.genresPicked} className="m-0 flex list-none flex-wrap gap-1.5 p-0" data-testid="research-genres-picked">
              {genres.map((g) => (
                <li key={g}>
                  <Button type="button" variant="outline" size="sm" aria-label={hiveNames.has(genreKey(g)) ? `Remove ${g}, ${hiveTitle}` : `Remove ${g}`} data-source={hiveNames.has(genreKey(g)) ? "hive" : undefined} disabled={busy} onClick={() => setGenres(genres.filter((x) => x !== g))}>
                    {hiveMark(g)}
                    {g}
                    <Icon name="x" size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <GenreSearch picked={genres} disabled={busy || genres.length >= MAX_RESEARCH_GENRES} onPick={add} />
          {unpicked.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-labelledby={suggestedId} data-testid="research-genre-suggested">
              <span id={suggestedId} className="mr-1 text-sm font-bold">
                {R.ask.suggested}
              </span>
              {unpicked.map((g) => (
                <Button key={g.id} type="button" variant="outline" size="sm" data-source={g.from === "hive" ? "hive" : undefined} disabled={busy || genres.length >= MAX_RESEARCH_GENRES} onClick={() => add(g.name)}>
                  {hiveMark(g.name)}
                  <Icon name="plus" size={14} />
                  {g.name}
                  {g.from === "hive" && <span className="sr-only">, {hiveTitle}</span>}
                </Button>
              ))}
            </div>
          )}
          <ToggleGroup
            type="multiple"
            value={genres.filter((g) => options.includes(g))}
            onValueChange={(broad) => setGenres([...genres.filter((g) => !options.includes(g) || broad.includes(g)), ...broad.filter((g) => !genres.includes(g))])}
            rovingFocus={false}
            variant="button"
            size="button-sm"
            spacing={1.5}
            aria-label={R.ask.quickPicks}
            className="w-auto"
            data-testid="research-genre-pick"
          >
            {options.map((option) => {
              const on = genres.includes(option);
              return (
                <ToggleGroupItem key={option} value={option} disabled={busy || (!on && genres.length >= MAX_RESEARCH_GENRES)}>
                  {option}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
        <div>
          <Button type="submit" size="sm" disabled={busy || !ready} data-testid="research-ask-carry-on">
            {R.ask.carryOn}
          </Button>
        </div>
      </form>
    </div>
  );
}
