/**
 * Example performers preloaded on the landing page (Melbourne). They are
 * illustrative personas, not real people. Their songs are well-known covers.
 */
import { formatHour, type Weekday } from "./slot";
import type { PlanRequest } from "./plan-schema";

export type ExamplePerformer = {
  id: string;
  label: string;
  blurb: string;
  weekday: Weekday;
  startHour: number;
  endHour: number;
  performer: PlanRequest["performer"];
};

export const EXAMPLES: ExamplePerformer[] = [
  {
    id: "acoustic",
    label: "Acoustic singer-songwriter",
    blurb: "Guitar and voice, Australian songbook covers. Saturday evening.",
    weekday: "saturday",
    startHour: 18,
    endHour: 21,
    performer: {
      name: "Acoustic singer-songwriter",
      artists: ["Paul Kelly", "Courtney Barnett", "Vance Joy", "Missy Higgins"],
      spotifyArtists: [],
      songs: [
        { title: "How to Make Gravy", artist: "Paul Kelly", own: false },
        { title: "Dumb Things", artist: "Paul Kelly", own: false },
        { title: "Depreston", artist: "Courtney Barnett", own: false },
        { title: "Avant Gardener", artist: "Courtney Barnett", own: false },
        { title: "Riptide", artist: "Vance Joy", own: false },
        { title: "Scar", artist: "Missy Higgins", own: false },
        { title: "The Special Two", artist: "Missy Higgins", own: false },
      ],
    },
  },
  {
    id: "sax",
    label: "Soul and funk sax player",
    blurb: "Solo saxophone over backing loops. Friday after work.",
    weekday: "friday",
    startHour: 17,
    endHour: 20,
    performer: {
      name: "Soul and funk sax player",
      artists: ["Stevie Wonder", "Amy Winehouse", "Hiatus Kaiyote", "Kamasi Washington"],
      spotifyArtists: [],
      songs: [
        { title: "Superstition", artist: "Stevie Wonder", own: false },
        { title: "Isn't She Lovely", artist: "Stevie Wonder", own: false },
        { title: "Valerie", artist: "Amy Winehouse", own: false },
        { title: "Back to Black", artist: "Amy Winehouse", own: false },
        { title: "Nakamarra", artist: "Hiatus Kaiyote", own: false },
        { title: "Truth", artist: "Kamasi Washington", own: false },
      ],
    },
  },
  {
    id: "folk-duo",
    label: "Folk duo",
    blurb: "Two voices, guitar and banjo. Sunday afternoon.",
    weekday: "sunday",
    startHour: 12,
    endHour: 15,
    performer: {
      name: "Folk duo",
      artists: ["Angus & Julia Stone", "The Paper Kites", "Simon & Garfunkel", "Mumford & Sons"],
      spotifyArtists: [],
      songs: [
        { title: "Big Jet Plane", artist: "Angus & Julia Stone", own: false },
        { title: "Bloom", artist: "The Paper Kites", own: false },
        { title: "The Boxer", artist: "Simon & Garfunkel", own: false },
        { title: "Mrs. Robinson", artist: "Simon & Garfunkel", own: false },
        { title: "Little Lion Man", artist: "Mumford & Sons", own: false },
        { title: "Harbour Lights", artist: "The Paper Kites", own: false },
      ],
    },
  },
];

export function findExample(id: string | null | undefined): ExamplePerformer | undefined {
  return EXAMPLES.find((e) => e.id === id);
}

/** "Saturday · 6–9 pm": the day and hours an example plays, the am/pm said once when both ends share it. */
export function exampleWhen(e: Pick<ExamplePerformer, "weekday" | "startHour" | "endHour">): string {
  const [from, fromSuffix] = formatHour(e.startHour).split(" ");
  const [to, toSuffix] = formatHour(e.endHour).split(" ");
  const hours = fromSuffix === toSuffix ? `${from}–${to} ${toSuffix}` : `${from} ${fromSuffix}–${to} ${toSuffix}`;
  return `${e.weekday[0].toUpperCase()}${e.weekday.slice(1)} · ${hours}`;
}

/** The first few songs an example plays, for its card ("Plays …"). */
export function examplePlays(e: ExamplePerformer, n = 3): string {
  return e.performer.songs.slice(0, n).map((s) => s.title).join(", ");
}
