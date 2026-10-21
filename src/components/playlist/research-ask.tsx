"use client";

import { useState } from "react";
import { ArtistPicker, typedArtists, type PickedArtist } from "@/components/landing/artist-picker";
import { Button } from "@/components/ui/button";
import { MAX_RESEARCH_GENRES } from "@/lib/repertoire-research";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { ResearchAnswer } from "./learn-api";

const R = PLAYLIST_COPY.research;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

/**
 * Inside the research step that waits (Who you sound like): the Hive's ask, the artist picker (2 or 3 artists you sound like) and a
 * genre. Artists and up to three genres are a selection that can be combined; nothing is sent until Carry on.
 */
export function ResearchAsk({ message, busy, onSubmit }: { message: string; busy: boolean; onSubmit: (answer: ResearchAnswer) => void }) {
  const [artists, setArtists] = useState<PickedArtist[]>([]);
  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const chosen = () => {
    const list = [...artists];
    for (const typed of typedArtists(query)) if (!list.some((a) => a.name.toLowerCase() === typed.toLowerCase())) list.push({ name: typed, spotifyId: null, image: null });
    return list.slice(0, 3).map((a) => ({ name: a.name, ...(a.spotifyId && SPOTIFY_ID.test(a.spotifyId) ? { spotifyId: a.spotifyId } : {}), ...(a.image && /^https:\/\//.test(a.image) && a.image.length <= 500 ? { image: a.image } : {}) }));
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
        <div role="group" aria-label={R.ask.genreLabel} className="flex flex-wrap items-center gap-1.5" data-testid="research-genre-pick">
          <span className="text-sm font-bold">{R.ask.genreLabel}</span>
          {R.genrePick.options.map((option) => {
            const on = genres.includes(option);
            return (
              <Button key={option} type="button" variant={on ? "default" : "outline"} size="sm" aria-pressed={on} disabled={busy || (!on && genres.length >= MAX_RESEARCH_GENRES)} onClick={() => setGenres(on ? genres.filter((g) => g !== option) : [...genres, option])}>
                {option}
              </Button>
            );
          })}
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
