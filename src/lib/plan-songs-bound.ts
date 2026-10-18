/**
 * The plan request takes the act's whole Repertoire (no product cap). The server bounds what it works on:
 * every song costs outside lookups (release years, artist entities, play counts) and prompt tokens, so a long
 * Repertoire is trimmed here, after the request is hashed and saved (the stored request keeps every song).
 *
 * Under the bound nothing changes (same songs, same order). Over it, songs are taken round-robin across artists,
 * so every artist keeps a song before any artist gets a second, and the act's own songs and covers both survive;
 * the picked songs keep their Repertoire order.
 */
/** Songs the engine looks up and orders per plan (the previous schema maximum). */
export const PLAN_SONGS_CONSIDERED = 60;
/** Songs written into the model prompt. */
export const PLAN_PROMPT_SONGS = 40;

type S = { artist: string; own?: boolean };

export function boundSongs<T extends S>(songs: readonly T[], max: number): T[] {
  if (songs.length <= max) return [...songs];
  const lanes = new Map<string, number[]>();
  songs.forEach((s, i) => {
    const key = s.artist.trim().toLowerCase();
    const lane = lanes.get(key);
    if (lane) lane.push(i);
    else lanes.set(key, [i]);
  });
  const picked: number[] = [];
  for (let round = 0; picked.length < max; round++) {
    let took = false;
    for (const lane of lanes.values()) {
      if (round < lane.length && picked.length < max) {
        picked.push(lane[round]);
        took = true;
      }
    }
    if (!took) break;
  }
  return picked.sort((a, b) => a - b).map((i) => songs[i]);
}
