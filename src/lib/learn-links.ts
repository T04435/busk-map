/**
 * "Learn it" links: plain searches on other sites, opened in a new tab.
 * Busk Map never shows lyrics or chords itself.
 */
export type LearnLink = { id: "karaoke" | "chords" | "lyrics"; label: string; href: string };

export function learnLinks(title: string, artist: string): LearnLink[] {
  const song = [title, artist].map((s) => s.trim()).filter(Boolean).join(" ");
  return [
    { id: "karaoke", label: "Karaoke (YouTube)", href: `https://www.youtube.com/results?${new URLSearchParams({ search_query: `${song} karaoke` })}` },
    { id: "chords", label: "Chords (Ultimate Guitar)", href: `https://www.ultimate-guitar.com/search.php?${new URLSearchParams({ search_type: "title", value: song })}` },
    { id: "lyrics", label: "Lyrics (Genius)", href: `https://genius.com/search?${new URLSearchParams({ q: song })}` },
  ];
}
