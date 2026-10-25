"use client";

import { useState } from "react";
import { ArtistPicker, typedArtists, type PickedArtist } from "@/components/landing/artist-picker";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MAX_RESEARCH_ARTISTS, MAX_RESEARCH_GENRES, type ResearchSuggest } from "@/lib/repertoire-research";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { ResearchAnswer } from "./learn-api";

const R = PLAYLIST_COPY.research;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

const genreKey = (name: string) => name.trim().toLowerCase();

/**
 * The genre buttons: the suggested ones (the act's own, then its sound-alikes'), then the fixed list, once each by name.
 */
export function genreOptions(suggest: ResearchSuggest | null | undefined): string[] {
  const out: string[] = [];
  for (const name of [...(suggest?.genres ?? []).map((g) => g.name), ...R.genrePick.options]) if (!out.some((o) => genreKey(o) === genreKey(name))) out.push(name);
  return out;
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
        <ToggleGroup
          type="multiple"
          value={genres}
          onValueChange={setGenres}
          rovingFocus={false}
          variant="button"
          size="button-sm"
          spacing={1.5}
          aria-label={R.ask.genreLabel}
          className="w-auto"
          data-testid="research-genre-pick"
        >
          <span className="text-sm font-bold">{R.ask.genreLabel}</span>
          {options.map((option) => {
            const on = genres.includes(option);
            return (
              <ToggleGroupItem key={option} value={option} disabled={busy || (!on && genres.length >= MAX_RESEARCH_GENRES)}>
                {option}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        <div>
          <Button type="submit" size="sm" disabled={busy || !ready} data-testid="research-ask-carry-on">
            {R.ask.carryOn}
          </Button>
        </div>
      </form>
    </div>
  );
}
