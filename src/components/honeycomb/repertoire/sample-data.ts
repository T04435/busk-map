import type { RepertoireResults, RepertoireStep, RepertoireTotals } from "@/components/honeycomb/repertoire/types";

/**
 * Sample data for the design preview of the Repertoire research flow (/design/repertoire). An illustrative persona, not a
 * real person: her own songs are made up; the other artists and songs are real, well-known ones. No real counts are claimed.
 */
export const SAMPLE_RESULTS: RepertoireResults = {
  profile: {
    name: "Hana Lee",
    image: null,
    genres: ["indie folk", "australian singer-songwriter", "acoustic pop"],
    audience: ["Youthful", "Mellow", "Romantic"],
    followers: 1840,
    href: "https://open.spotify.com/artist/sample",
  },
  summary:
    "A Melbourne singer-songwriter with a warm, finger-picked folk sound. Your fans lean 18 to 29 and lean female, and they also love Angus & Julia Stone and The Paper Kites, so laneway crowds on a slow afternoon are yours.",
  fans: {
    age: [
      { label: "18–24", lean: 0.34 },
      { label: "25–29", lean: 0.21 },
      { label: "30–34", lean: -0.05 },
      { label: "35–44", lean: -0.18 },
      { label: "45+", lean: -0.31 },
    ],
    gender: [
      { label: "Female", lean: 0.22 },
      { label: "Male", lean: -0.22 },
    ],
  },
  soundsLike: [
    { name: "Angus & Julia Stone", source: "qloo", tags: ["indie folk", "australian"] },
    { name: "The Paper Kites", source: "qloo", tags: ["indie folk", "dream pop"] },
    { name: "Missy Higgins", source: "spotify", tags: ["australian pop"] },
    { name: "Vance Joy", source: "qloo", tags: ["folk pop"] },
  ],
  fansLove: [
    { name: "Boy & Bear", source: "qloo", tags: ["indie folk"] },
    { name: "Julia Jacklin", source: "qloo", tags: ["indie"] },
    { name: "Hollow Coves", source: "qloo", tags: ["acoustic"] },
  ],
  canSing: [
    { id: "o1", title: "Southbank in the Rain", artist: "Hana Lee", year: 2024, album: "Laneways", durationMs: 214000, own: true },
    { id: "o2", title: "Paper Lanterns", artist: "Hana Lee", year: 2023, album: "Laneways", durationMs: 187000, own: true },
    { id: "c1", title: "Riptide", artist: "Vance Joy", year: 2013, durationMs: 204000 },
    { id: "c2", title: "Big Jet Plane", artist: "Angus & Julia Stone", year: 2010, durationMs: 239000 },
    { id: "c3", title: "Bloom", artist: "The Paper Kites", year: 2010, durationMs: 214000 },
    { id: "c4", title: "Scar", artist: "Missy Higgins", year: 2004, durationMs: 214000 },
    { id: "c5", title: "Mess Is Mine", artist: "Vance Joy", year: 2014, durationMs: 227000 },
    { id: "c6", title: "Private Lawns", artist: "Angus & Julia Stone", year: 2010, durationMs: 235000 },
    { id: "c7", title: "Featherstone", artist: "The Paper Kites", year: 2013, durationMs: 258000 },
    { id: "c8", title: "The Special Two", artist: "Missy Higgins", year: 2004, durationMs: 232000 },
    { id: "c9", title: "Fire and the Flood", artist: "Vance Joy", year: 2014, durationMs: 253000 },
    { id: "c10", title: "Draw Your Swords", artist: "Angus & Julia Stone", year: 2010, durationMs: 262000 },
    { id: "c11", title: "Walking in the Wind", artist: "The Paper Kites", year: 2013, durationMs: 188000 },
    { id: "c12", title: "Steer", artist: "Missy Higgins", year: 2004, durationMs: 245000 },
    { id: "c13", title: "Georgia", artist: "Vance Joy", year: 2014, durationMs: 214000 },
    { id: "c14", title: "Yellow Brick Road", artist: "Angus & Julia Stone", year: 2010, durationMs: 249000 },
  ],
  toLearn: [
    {
      id: "l1",
      title: "Fool",
      artist: "Boy & Bear",
      year: 2011,
      durationMs: 236000,
      reason: "Fans of Angus & Julia Stone and The Paper Kites love this.",
      because: [{ name: "Angus & Julia Stone" }, { name: "The Paper Kites" }],
      status: "pending",
      fresh: true,
    },
    {
      id: "l2",
      title: "Pool",
      artist: "Julia Jacklin",
      year: 2019,
      durationMs: 222000,
      reason: "Your fans over-index on Julia Jacklin, and this is her most-played song.",
      because: [{ name: "Julia Jacklin" }],
      status: "pending",
      fresh: true,
    },
    {
      id: "l3",
      title: "Coastline",
      artist: "Hollow Coves",
      year: 2017,
      durationMs: 211000,
      reason: "Fans of Vance Joy love this, and it sits in your key range of mellow acoustic songs.",
      because: [{ name: "Vance Joy" }, { name: "Hollow Coves" }],
      status: "pending",
      fresh: true,
    },
    {
      id: "l4",
      title: "Young Folks",
      artist: "Peter Bjorn and John",
      year: 2006,
      durationMs: 275000,
      reason: "Fans of The Paper Kites stop for it.",
      because: [{ name: "The Paper Kites" }],
      status: "learned",
    },
    {
      id: "l5",
      title: "Somebody That I Used to Know",
      artist: "Gotye",
      year: 2011,
      durationMs: 244000,
      reason: "Fans of Missy Higgins love this.",
      because: [{ name: "Missy Higgins" }],
      status: "dismissed",
    },
  ],
  learned: [{ id: "d1", title: "Holocene", artist: "Bon Iver", year: 2011, durationMs: 337000 }],
};

const DONE: RepertoireStep[] = [
  { key: "profile", status: "done", found: "We found Hana Lee on Spotify: indie folk, australian singer-songwriter, 1,840 followers.", cells: [{ name: "Hana Lee" }] },
  { key: "songs", status: "done", found: "We added your 2 songs from 1 release.", cells: [{ name: "Southbank in the Rain" }, { name: "Paper Lanterns" }] },
  { key: "qloo", status: "done", found: "Qloo has you as indie folk, with audience tags Youthful, Mellow and Romantic." },
  {
    key: "soundsLike",
    status: "done",
    found: "We found 4 artists you sound like. Your fans' strongest overlap is with Angus & Julia Stone and The Paper Kites (Qloo affinity).",
    cells: [{ name: "Angus & Julia Stone" }, { name: "The Paper Kites" }, { name: "Missy Higgins" }, { name: "Vance Joy" }],
  },
  { key: "fans", status: "done", found: "Qloo's demographics: your fans lean 18 to 29, with more women." },
  { key: "fansMap", status: "done", found: "Qloo places your taste strongest in Melbourne, Sydney and London." },
  { key: "fansLove", status: "done", found: "Beyond your sound-alikes, your fans over-index on Boy & Bear, Julia Jacklin and Hollow Coves (Qloo).", cells: [{ name: "Boy & Bear" }, { name: "Julia Jacklin" }, { name: "Hollow Coves" }] },
  { key: "learn", status: "done", found: "We checked 40 real top tracks on Spotify and kept 3 your fans would stop for. Each one says why." },
  { key: "genres", status: "done", found: "Qloo tags: indie folk, acoustic pop, singer-songwriter." },
  { key: "summary", status: "done", found: "We summed up your act in one paragraph, from the steps above." },
];

/** Every step done. */
export const SAMPLE_STEPS_DONE = DONE;

/** Mid-run: steps 1–4 done, step 5 working, the rest waiting. */
export const SAMPLE_STEPS_RUNNING: RepertoireStep[] = DONE.map((s, i) =>
  i < 4 ? s : i === 4 ? { key: s.key, status: "running" } : { key: s.key, status: "pending" },
);

export const SAMPLE_TOTALS_DONE: RepertoireTotals = { qlooCalls: 8, songs: 2, soundsLike: 4, fanArtists: 3, songsChecked: 40, toLearn: 3 };
export const SAMPLE_TOTALS_RUNNING: Partial<RepertoireTotals> = { qlooCalls: 4, songs: 2, soundsLike: 4, toLearn: null };

/** What the results look like mid-run: the profile, your songs and who you sound like are in; the rest is still coming. */
export const SAMPLE_RESULTS_RUNNING: RepertoireResults = {
  ...SAMPLE_RESULTS,
  summary: null,
  fans: null,
  fansLove: null,
  toLearn: null,
  learned: null,
};

/**
 * The sample act's top cities, strongest first: what DEV passes as `cities` (name, centre, affinity 0 to 1). Melbourne leads (affinity 1,
 * the act's best cell), then Sydney, London, Portland and Berlin.
 */
export const SAMPLE_FANS_CITIES: { name: string; lat: number; lng: number; affinity: number }[] = [
  { name: "Melbourne", lng: 144.9631, lat: -37.8136, affinity: 1 },
  { name: "Sydney", lng: 151.2093, lat: -33.8688, affinity: 0.75 },
  { name: "London", lng: -0.1276, lat: 51.5072, affinity: 0.62 },
  { name: "Portland", lng: -122.6765, lat: 45.5231, affinity: 0.6 },
  { name: "Berlin", lng: 13.405, lat: 52.52, affinity: 0.52 },
];

/**
 * City-scale taste cells (U40): a pointy-top hex lattice of about 0.05° (5 km) cells in a small cluster around each top city, strongest
 * at the centre and falling off over a few km. Not one coarse blob per country: zoom in and the cells resolve to neighbourhoods.
 */
export const SAMPLE_FANS_CELLS: { lat: number; lng: number; affinity: number }[] = (() => {
  const cells: { lat: number; lng: number; affinity: number }[] = [];
  const stepLng = 0.05;
  const stepLat = 0.0433;
  for (const { lng: hx, lat: hy, affinity: peak } of SAMPLE_FANS_CITIES) {
    for (let row = -7; row <= 7; row++) {
      for (let col = -7; col <= 7; col++) {
        const lat = hy + row * stepLat;
        const lng = hx + col * stepLng + (row % 2 ? stepLng / 2 : 0);
        // A lopsided spread so the cluster reads like a city, not a disc.
        const a = peak * Math.exp(-(((lng - hx) / 0.22) ** 2 + ((lat - hy) / 0.17) ** 2) + 0.15 * Math.sin((lng - hx) * 19 + (lat - hy) * 13));
        if (a > 0.3) cells.push({ lat, lng, affinity: Math.min(1, a) });
      }
    }
  }
  return cells;
})();

