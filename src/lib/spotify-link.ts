/** Accepts an open.spotify.com artist link, a spotify:artist: URI or a bare 22-character id. Client-safe. */
export function parseSpotifyArtistId(input: string): string | null {
  const value = input.trim();
  const match =
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?artist\/([A-Za-z0-9]{22})/.exec(value) ??
    /^spotify:artist:([A-Za-z0-9]{22})$/.exec(value) ??
    /^([A-Za-z0-9]{22})$/.exec(value);
  return match?.[1] ?? null;
}

/** The profile link shown in the field for a saved id. */
export const spotifyArtistUrl = (id: string) => `https://open.spotify.com/artist/${id}`;
