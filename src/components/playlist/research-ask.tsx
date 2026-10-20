"use client";

import { useState } from "react";
import { ArtistPicker, typedArtists, type PickedArtist } from "@/components/landing/artist-picker";
import { Button } from "@/components/ui/button";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

const R = PLAYLIST_COPY.research;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

/**
 * Inside the research step that waits (Who you sound like): the Hive's ask, the artist picker (2 or 3 artists you sound like) and,
 * instead, a genre. Either answer carries on the same run.
 */
export function ResearchAsk({ message, busy, onArtists, onGenre }: { message: string; busy: boolean; onArtists: (artists: { name: string; spotifyId?: string }[]) => void; onGenre: (genre: string) => void }) {
  const [artists, setArtists] = useState<PickedArtist[]>([]);
  const [query, setQuery] = useState("");
  const chosen = () => {
    const list = [...artists];
    for (const typed of typedArtists(query)) if (!list.some((a) => a.name.toLowerCase() === typed.toLowerCase())) list.push({ name: typed, spotifyId: null, image: null });
    return list.slice(0, 3).map((a) => ({ name: a.name, ...(a.spotifyId && SPOTIFY_ID.test(a.spotifyId) ? { spotifyId: a.spotifyId } : {}) }));
  };
  const ready = artists.length > 0 || typedArtists(query).length > 0;
  return (
    <div className="grid min-w-0 gap-4" data-testid="research-ask">
      <p className="m-0 max-w-prose text-sm leading-5" data-testid="research-ask-line">
        {message}
      </p>
      <form
        className="grid max-w-2xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && ready) onArtists(chosen());
        }}
      >
        <ArtistPicker value={artists} onChange={setArtists} query={query} onQueryChange={setQuery} />
        <div>
          <Button type="submit" size="sm" disabled={busy || !ready} data-testid="research-ask-carry-on">
            {R.ask.carryOn}
          </Button>
        </div>
      </form>
      <div role="group" aria-label={R.ask.genreLabel} className="flex flex-wrap items-center gap-1.5" data-testid="research-genre-pick">
        <span className="text-sm font-bold">{R.ask.genreLabel}</span>
        {R.genrePick.options.map((genre) => (
          <Button key={genre} type="button" variant="outline" size="sm" disabled={busy} onClick={() => onGenre(genre)}>
            {genre}
          </Button>
        ))}
      </div>
    </div>
  );
}
