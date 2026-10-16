/**
 * The brain of Busk Map: how Qloo data flows through the app, as built on dev/core.
 *
 * One source of truth for the /brain page and the landing teaser. The facts come from docs/qloo-data-map.md
 * (commit 4164685): Qloo calls → the data points they return → the parts of a busk they decide. Spotify, Ticketmaster
 * and Last.fm are the secondary sources shown. Client-safe: plain data and pure helpers.
 *
 * tests/unit/lib/qloo-map.test.ts keeps this honest: every link target exists, nothing is orphaned, and the set of
 * `calls[].codeRef` equals the client functions that send a Qloo request (read from the adapter's source), and the
 * Last.fm calls in `secondarySources` equal the requests in adapters/songs/client.ts, so neither adapter can gain or
 * lose a call without this map changing too.
 */

import { PLAYLIST_COPY } from "@/lib/playlist-copy";

export type CallId = "c1" | "c2" | "c3" | "c4" | "c5" | "c5b" | "c5c" | "c6" | "c7" | "c7b" | "c8" | "c9" | "c10" | "c11" | "c11b" | "c12" | "c13" | "c14" | "c_fans";
export type SourceId = "spotify" | "ticketmaster" | "lastfm";
export type DataPointId =
  | "d_id"
  | "d_cells"
  | "d_places"
  | "d_vibe"
  | "d_crowd"
  | "d_because"
  | "d_usual"
  | "d_pitchaff"
  | "d_headliner"
  | "d_events"
  | "d_trend"
  | "d_demo"
  | "d_genre"
  | "d_contrast"
  | "d_overindex"
  | "d_scene"
  | "d_years"
  | "d_taste_artists"
  | "d_tracks"
  | "d_plays"
  | "d_own_signal"
  | "d_fans";
export type FeatureId = "f_rank" | "f_map" | "f_events" | "f_crowd" | "f_fans" | "f_setlist" | "f_plain" | "f_agent" | "f_learn";
export type NodeId = CallId | SourceId | DataPointId | FeatureId;
export type NodeKind = "call" | "source" | "dataPoint" | "feature";

/** One link to the next column, with how it is used. */
export type Link<T extends NodeId> = { id: T; how: string };

export type QlooCall = {
  id: CallId;
  /** The number in docs/qloo-data-map.md §1 ("5b" is a variant of 5). */
  num: string;
  label: string;
  /** HTTP path, e.g. "/v2/insights". */
  endpoint: string;
  /** The `filter.type` (or `/search` `types`) sent, when the call sends one. */
  urnType?: string;
  keyParams: readonly string[];
  /** The client function that sends the request: `client.ts:<function>` in src/server/adapters/qloo. */
  codeRef: `client.ts:${string}`;
  /** Who calls it (`file:function`), for the reader. */
  via: readonly string[];
  /** Set on a variant: the same client call made another way. Variants don't count as a kind of call. */
  variantOf?: CallId;
  dataPoints: readonly Link<DataPointId>[];
};

/** One request an outside source's client sends (checked against the source's code by the drift test). */
export type SourceLookup = {
  /** The Last.fm API method sent, e.g. "artist.gettoptracks". */
  method: string;
  /** The client function that sends it: `songs/client.ts:<function>`. */
  codeRef: `songs/client.ts:${string}`;
  /** Who calls it (`file:function`), for the reader. */
  via: readonly string[];
  /** What it is for. */
  purpose: string;
};

export type SecondarySource = {
  id: SourceId;
  label: string;
  contributes: string;
  dataPoints: readonly Link<DataPointId>[];
  /** The requests this source's client sends, when the drift test covers them (Last.fm). */
  lookups?: readonly SourceLookup[];
};

export type DataPoint = {
  id: DataPointId;
  label: string;
  sub: string;
  /** Response fields read (from the producing calls or sources). */
  fields: readonly string[];
  features: readonly Link<FeatureId>[];
};

export type FeatureHow = "direct" | "combined" | "diff";

export type Feature = {
  id: FeatureId;
  label: string;
  sub: string;
  /** Where it shows in the app. */
  location: string;
  how: FeatureHow;
  /** For "combined": the other sources it combines Qloo with. For "diff": the two sides compared. */
  with?: readonly string[];
};

export type NextItem = { id: string; label: string; built: false };

export const calls: readonly QlooCall[] = [
  {
    id: "c1",
    num: "1",
    label: "Artist search",
    endpoint: "/search",
    urnType: "urn:entity:artist",
    keyParams: ["query=<artist name>", "types=urn:entity:artist", "take=3"],
    codeRef: "client.ts:searchArtist",
    via: ["index.ts:resolveArtists", "learn/context.ts:matchPlaylist"],
    dataPoints: [{ id: "d_id", how: "matches each artist by name when there is no Spotify id" }],
  },
  {
    id: "c2",
    num: "2",
    label: "Spotify id match",
    endpoint: "/entities",
    keyParams: ["external.spotify.ids=<id>"],
    codeRef: "client.ts:entitiesBySpotifyIds",
    via: ["index.ts:resolveArtists", "learn/context.ts:matchPlaylist"],
    dataPoints: [
      { id: "d_id", how: "matches an artist by its Spotify id, so the right namesake is picked" },
      { id: "d_own_signal", how: "matches your own artist from the saved Spotify link, so it joins the taste signal" },
    ],
  },
  {
    id: "c3",
    num: "3",
    label: "Taste heatmap",
    endpoint: "/v2/insights",
    urnType: "urn:heatmap",
    keyParams: ["signal.interests.entities=<act ids>", "filter.location=<WKT POLYGON>"],
    codeRef: "client.ts:heatmap",
    via: ["index.ts:tasteMap"],
    dataPoints: [{ id: "d_cells", how: "cells across the city, each with affinity and popularity" }],
  },
  {
    id: "c4",
    num: "4",
    label: "Places nearby",
    endpoint: "/v2/insights",
    urnType: "urn:entity:place",
    keyParams: ["filter.location=<WKT POINT>", "filter.location.radius=2000", "filter.hours=<weekday>", "signal.interests.entities", "take=50"],
    codeRef: "client.ts:places",
    via: ["index.ts:busyPlaces"],
    dataPoints: [
      { id: "d_places", how: "places near the centre with popularity, opening hours and taste match" },
      { id: "d_vibe", how: "live music, “good for” and keywords for each place" },
    ],
  },
  {
    id: "c5",
    num: "5",
    label: "Artists nearby, explained",
    endpoint: "/v2/insights",
    urnType: "urn:entity:artist",
    keyParams: ["signal.location=<WKT POLYGON>", "signal.interests.entities=<act ids>", "feature.explainability=true", "take=20"],
    codeRef: "client.ts:localArtists",
    via: ["context.ts:localCrowd"],
    dataPoints: [
      { id: "d_crowd", how: "artists liked around the area, with affinity" },
      { id: "d_because", how: "which of your artists explain each one" },
    ],
  },
  {
    id: "c5b",
    num: "5b",
    label: "The usual crowd",
    endpoint: "/v2/insights",
    urnType: "urn:entity:artist",
    keyParams: ["signal.location=<WKT POLYGON around a hotspot>", "take=20", "no interest signal"],
    codeRef: "client.ts:localArtists",
    via: ["context.ts:hotspotCrowd"],
    variantOf: "c5",
    dataPoints: [
      { id: "d_usual", how: "the same question with no taste signal: everyone near a busking hotspot" },
      { id: "d_overindex", how: "its top 20 artists are group a of the city over-index compare (c11b)" },
    ],
  },
  {
    id: "c5c",
    num: "5c",
    label: "Your usual pitches",
    endpoint: "/v2/insights",
    urnType: "urn:entity:artist",
    keyParams: ["signal.location=<WKT POLYGON around a usual pitch, 400 m>", "signal.interests.entities=<Repertoire ids>", "feature.explainability=true", "take=10"],
    codeRef: "client.ts:localArtists",
    via: ["learn/tools.ts:crowd_at"],
    variantOf: "c5",
    dataPoints: [{ id: "d_taste_artists", how: "the artists the crowd at one of your usual pitches likes, from fans of your songs" }],
  },
  {
    id: "c6",
    num: "6",
    label: "Affinity at a pitch",
    endpoint: "/v2/insights",
    urnType: "urn:entity:artist",
    keyParams: ["filter.results.entities=<song artists>", "signal.location=<WKT POINT>", "signal.location.radius=400"],
    codeRef: "client.ts:affinityAt",
    via: ["index.ts:artistAffinityAt"],
    dataPoints: [{ id: "d_pitchaff", how: "how much the crowd at one pitch likes each song’s artist" }],
  },
  {
    id: "c7",
    num: "7",
    label: "Headliner match",
    endpoint: "/v2/insights",
    urnType: "urn:entity:artist",
    keyParams: ["filter.results.entities=<headliners>", "signal.interests.entities=<act ids>"],
    codeRef: "client.ts:affinityFor",
    via: ["index.ts:tasteMatch"],
    dataPoints: [{ id: "d_headliner", how: "how much your fans like each event’s headliner" }],
  },
  {
    id: "c7b",
    num: "7b",
    label: "Local acts, scored for your fans",
    endpoint: "/v2/insights",
    urnType: "urn:entity:artist",
    keyParams: ["filter.results.entities=<local scene list ids>", "signal.interests.entities=<act ids>"],
    codeRef: "client.ts:affinityFor",
    via: ["index.ts:tasteMatch", "context.ts:localScene"],
    variantOf: "c7",
    dataPoints: [{ id: "d_scene", how: "re-scores the city’s local acts by how much your fans like each" }],
  },
  {
    id: "c8",
    num: "8",
    label: "Trending",
    endpoint: "/v2/trending",
    urnType: "urn:entity:artist",
    keyParams: ["signal.interests.entities=<one id>", "filter.start_date", "filter.end_date (42 days)"],
    codeRef: "client.ts:trendingFor",
    via: ["client.ts:trendingWindow", "client.ts:trending", "context.ts:rising", "learn/tools.ts:rising"],
    dataPoints: [{ id: "d_trend", how: "how fast each artist is rising" }],
  },
  {
    id: "c9",
    num: "9",
    label: "Demographics",
    endpoint: "/v2/insights",
    urnType: "urn:demographics",
    keyParams: ["signal.interests.entities=<act ids>"],
    codeRef: "client.ts:demographics",
    via: ["index.ts:crowdProfile", "learn/tools.ts:crowd_profile"],
    dataPoints: [{ id: "d_demo", how: "the age and gender your fans lean" }],
  },
  {
    id: "c10",
    num: "10",
    label: "Genres nearby",
    endpoint: "/v2/insights",
    urnType: "urn:tag",
    keyParams: ["filter.tag.types=urn:tag:genre:music", "signal.location=<WKT POINT>", "signal.location.radius=400", "take=6"],
    codeRef: "client.ts:crowdTags",
    via: ["context.ts:crowdGenres"],
    dataPoints: [{ id: "d_genre", how: "music genres liked within 400 m of a pitch" }],
  },
  {
    id: "c11",
    num: "11",
    label: "Compare two crowds",
    endpoint: "/v2/analysis/compare",
    keyParams: ["a.signal.interests.entities=<act ids>", "b.signal.interests.entities=<usual crowd ids>"],
    codeRef: "client.ts:compareGenres",
    via: ["context.ts:contrast"],
    dataPoints: [{ id: "d_contrast", how: "genre shares for your fans and the usual crowd" }],
  },
  {
    id: "c11b",
    num: "11b",
    label: "The city’s genres vs global pop",
    endpoint: "/v2/analysis/compare",
    keyParams: ["a.signal.interests.entities=<usual crowd top 20 (5b)>", "b.signal.interests.entities=<global-pop artists (c13)>"],
    codeRef: "client.ts:compareGenres",
    via: ["context.ts:localScene"],
    variantOf: "c11",
    dataPoints: [{ id: "d_overindex", how: "the 1–7 genres the city’s crowd leans to by 0.15 or more over global pop" }],
  },
  {
    id: "c12",
    num: "12",
    label: "Artists like yours",
    endpoint: "/v2/insights",
    urnType: "urn:entity:artist",
    keyParams: ["signal.interests.entities=<Repertoire ids>", "feature.explainability=true", "take=20", "no location"],
    codeRef: "client.ts:tasteArtists",
    via: ["learn/tools.ts:related_artists"],
    dataPoints: [{ id: "d_taste_artists", how: "artists whose fans overlap your Repertoire’s fans, anywhere, and which of your artists explain each" }],
  },
  {
    id: "c13",
    num: "13",
    label: "Global-pop artists",
    endpoint: "/v2/insights",
    urnType: "urn:entity:artist",
    keyParams: ["take=20", "no interest signal", "no location"],
    codeRef: "client.ts:globalArtists",
    via: ["index.ts:globalArtists", "context.ts:localScene"],
    dataPoints: [{ id: "d_overindex", how: "the global-pop set the city’s crowd is compared with; the same for every city, so cached once for all" }],
  },
  {
    id: "c14",
    num: "14",
    label: "Local scene artists",
    endpoint: "/v2/insights",
    urnType: "urn:entity:artist",
    keyParams: ["signal.location=<WKT POLYGON, the city box>", "signal.interests.tags=<the city’s genre ids>", "take=20", "no artist signal"],
    codeRef: "client.ts:sceneArtists",
    via: ["index.ts:sceneArtists", "context.ts:localScene"],
    dataPoints: [{ id: "d_scene", how: "artists of the city’s own genres liked in the plan area, shared by every act" }],
  },
  {
    id: "c_fans",
    num: "9b",
    label: "Your own fans",
    endpoint: "/v2/insights",
    urnType: "urn:demographics",
    keyParams: ["signal.interests.entities=<your own artist id>"],
    codeRef: "client.ts:demographics",
    via: ["context.ts:ownFans", "index.ts:crowdProfile"],
    variantOf: "c9",
    dataPoints: [{ id: "d_fans", how: "the age and gender lean of the fans of your own artist alone, one request per busk" }],
  },
];

export const secondarySources: readonly SecondarySource[] = [
  {
    id: "spotify",
    label: "Spotify",
    contributes: "artist ids, release years, songs to learn",
    dataPoints: [
      { id: "d_id", how: "the artist picker supplies the Spotify id" },
      { id: "d_years", how: "release years for your songs" },
      { id: "d_tracks", how: "songs by the artists a learn run chooses" },
    ],
  },
  {
    id: "ticketmaster",
    label: "Ticketmaster",
    contributes: "events near each pitch",
    dataPoints: [
      { id: "d_events", how: "event times, venues and headliners" },
      { id: "d_headliner", how: "the headliner names Qloo matches" },
    ],
  },
  {
    id: "lastfm",
    label: "Last.fm",
    contributes: "song plays, and songs when Spotify has none",
    dataPoints: [
      { id: "d_plays", how: "top tracks per artist, with how many times each is played" },
      { id: "d_tracks", how: "the songs backup: a learn run takes an artist’s top tracks from Last.fm when Spotify has none" },
    ],
    lookups: [
      {
        method: "artist.gettoptracks",
        codeRef: "songs/client.ts:fetchTopTracks",
        via: ["songs/index.ts:getSongs", "learn/tools.ts:top_tracks"],
        purpose: "an artist’s top tracks and their plays",
      },
      {
        method: "artist.getinfo",
        codeRef: "songs/client.ts:fetchArtistListeners",
        via: ["songs/index.ts:getListeners"],
        purpose: "listener counts beside the artists in the picker (not part of the graph)",
      },
    ],
  },
];

export const dataPoints: readonly DataPoint[] = [
  {
    id: "d_id",
    label: "Your artists on Qloo",
    sub: "every later call starts here",
    fields: ["entity_id", "name"],
    features: [
      { id: "f_rank", how: "every taste question signals with your artists" },
      { id: "f_map", how: "the heatmap is signalled with your artists" },
      { id: "f_crowd", how: "an artist Qloo can’t match is named in a warning" },
      { id: "f_learn", how: "every look in a learn run signals with your Repertoire’s artists" },
    ],
  },
  {
    id: "d_cells",
    label: "Taste cells",
    sub: "affinity and popularity by area",
    fields: ["location.latitude", "location.longitude", "location.geohash", "query.affinity", "query.popularity"],
    features: [
      { id: "f_map", how: "the coloured taste cells" },
      { id: "f_rank", how: "picks the candidate pitches and sets the taste score" },
      { id: "f_plain", how: "scores the plain AI’s spots the same way" },
      { id: "f_agent", how: "the taste_map tool, which can zoom in" },
    ],
  },
  {
    id: "d_places",
    label: "Open places",
    sub: "popularity, hours, taste match",
    fields: ["entity_id", "name", "location.lat", "location.lon", "popularity", "query.affinity", "properties.hours"],
    features: [
      { id: "f_rank", how: "busy places open in your slot" },
      { id: "f_plain", how: "scores the plain AI’s spots the same way" },
      { id: "f_agent", how: "the busy_places tool, at any point" },
    ],
  },
  {
    id: "d_vibe",
    label: "Venue detail",
    sub: "live music, good for, keywords",
    fields: ["properties.live_music", "properties.good_for[].name", "properties.good_for[].weight", "properties.keywords[].name", "properties.keywords[].count"],
    features: [{ id: "f_rank", how: "shown on each pitch: “live music, known for bands” (shown, not scored)" }],
  },
  {
    id: "d_crowd",
    label: "Artists this crowd likes",
    sub: "with affinity",
    fields: ["entity_id", "name", "query.affinity", "query.measurements.audience_growth", "external.lastfm[].listeners"],
    features: [
      { id: "f_crowd", how: "who this crowd likes" },
      { id: "f_setlist", how: "songs to learn: the crowd’s top artists" },
      { id: "f_agent", how: "the crowd_at tool" },
    ],
  },
  {
    id: "d_because",
    label: "The “because” artists",
    sub: "explainability",
    fields: ["query.explainability (per result)", "query.explainability.effect_on_top10_recs"],
    features: [{ id: "f_crowd", how: "the “because” artists, and what Qloo matched on" }],
  },
  {
    id: "d_usual",
    label: "The usual crowd’s artists",
    sub: "near a busking hotspot",
    fields: ["entity_id", "name", "query.affinity"],
    features: [{ id: "f_fans", how: "the crowd that is there anyway" }],
  },
  {
    id: "d_pitchaff",
    label: "Song artists at a pitch",
    sub: "affinity within 400 m",
    fields: ["entity_id", "query.affinity"],
    features: [
      { id: "f_setlist", how: "nearly half of each song’s score, pitch by pitch" },
      { id: "f_agent", how: "the build_setlist and compare_crowds tools" },
    ],
  },
  {
    id: "d_headliner",
    label: "Headliner taste match",
    sub: "your fans vs an event’s act",
    fields: ["entity_id", "query.affinity"],
    features: [
      { id: "f_events", how: "an event’s crowd counts more when its act matches your taste" },
      { id: "f_rank", how: "feeds the events part of each pitch score" },
      { id: "f_plain", how: "scores the plain AI’s spots the same way" },
      { id: "f_agent", how: "the events_near tool" },
    ],
  },
  {
    id: "d_events",
    label: "Events and times",
    sub: "from Ticketmaster",
    fields: ["event start time", "venue", "headliner names"],
    features: [{ id: "f_events", how: "when crowds arrive and leave near each pitch" }],
  },
  {
    id: "d_trend",
    label: "Who is rising",
    sub: "trend change by artist",
    fields: ["date", "population_percent_delta", "population_percentile"],
    features: [
      { id: "f_setlist", how: "ranks the songs to learn" },
      { id: "f_crowd", how: "the “Rising” badge" },
      { id: "f_agent", how: "the learn_these tool" },
      { id: "f_learn", how: "who is rising among the artists a run found" },
    ],
  },
  {
    id: "d_demo",
    label: "Age and gender lean",
    sub: "of your fans",
    fields: ["query.age", "query.gender"],
    features: [
      { id: "f_crowd", how: "who your fans are" },
      { id: "f_setlist", how: "era fit: songs from your crowd’s years" },
      { id: "f_agent", how: "the crowd_at tool" },
      { id: "f_learn", how: "era fit, with the age your fans lean" },
    ],
  },
  {
    id: "d_genre",
    label: "Genres around a pitch",
    sub: "music genres, affinity",
    fields: ["tag_id (or id)", "name", "query.affinity"],
    features: [
      { id: "f_crowd", how: "the genres around your top pitch" },
      { id: "f_agent", how: "the crowd_at and compare_crowds tools" },
    ],
  },
  {
    id: "d_contrast",
    label: "Genre shares, side by side",
    sub: "your fans vs the usual crowd",
    fields: ["results.a[].tag_id", "results.b[].tag_id", "name", "subtype", "query.count"],
    features: [{ id: "f_fans", how: "your fans lean more towards some genres, less towards others" }],
  },
  {
    id: "d_overindex",
    label: "The city’s genres vs global pop",
    sub: "what the city leans to",
    fields: ["results.a[].tag_id", "results.b[].tag_id", "name", "subtype", "query.count"],
    features: [
      { id: "f_crowd", how: "the genres named in “Local scene”" },
      { id: "f_agent", how: "the crowd_at tool’s localScene" },
    ],
  },
  {
    id: "d_scene",
    label: "Local acts your fans would like",
    sub: "the local scene, re-scored",
    fields: ["entity_id", "name", "query.affinity"],
    features: [
      { id: "f_crowd", how: "“Local scene: … acts your fans would like”" },
      { id: "f_setlist", how: "a song by a local act gets a lift in the set order, and local acts are offered as suggested songs" },
      { id: "f_agent", how: "the crowd_at and build_setlist tools" },
    ],
  },
  {
    id: "d_years",
    label: "Release years",
    sub: "from Spotify",
    fields: ["release year"],
    features: [{ id: "f_setlist", how: "era fit, with your fans’ age lean" }],
  },
  {
    id: "d_taste_artists",
    label: "Artists to learn from",
    sub: "fans of your songs",
    fields: ["entity_id", "name", "query.affinity", "query.explainability", "query.measurements.audience_growth"],
    features: [{ id: "f_learn", how: "the artists a learn run chooses songs from, each with who explains it" }],
  },
  {
    id: "d_tracks",
    label: "Songs by those artists",
    sub: "from Spotify",
    fields: ["track title", "artist", "release year", "duration"],
    features: [{ id: "f_learn", how: "the songs a run picks from; earlier suggestions are left out here" }],
  },
  {
    id: "d_plays",
    label: "Song plays",
    sub: "from Last.fm",
    fields: ["track title", "playcount", "listeners"],
    features: [
      { id: "f_setlist", how: "about a third of each song’s score is how well-known it is; it also ranks the songs to learn" },
      { id: "f_agent", how: "the build_setlist and learn_these tools" },
    ],
  },
  {
    id: "d_own_signal",
    label: "Your own artist in the signal",
    sub: "joins the artists you sound like",
    fields: ["entity_id", "name"],
    features: [
      { id: "f_rank", how: "the own artist leads the signal for the taste map and the crowd match" },
      { id: "f_crowd", how: "“from your music”: how much your own artist drove the crowd’s picks" },
    ],
  },
  {
    id: "d_fans",
    label: "Your own fans",
    sub: "age and gender of your artist’s fans",
    fields: ["query.age", "query.gender"],
    features: [{ id: "f_crowd", how: "“Your fans lean 25–29; this crowd leans 30–34”, beside the crowd’s own lean bars" }],
  },
];

export const features: readonly Feature[] = [
  {
    id: "f_rank",
    label: "Pitch ranking",
    sub: "your three pitches, scored",
    location: "Plan page: the top 3 pitches and their scores",
    how: "combined",
    with: ["City of Melbourne sensors", "the council’s busking rules", "OSM spots", "Ticketmaster", "Open-Meteo"],
  },
  { id: "f_map", label: "Taste map", sub: "where your taste lives", location: "Plan page: the map’s taste cells", how: "direct" },
  {
    id: "f_events",
    label: "Event weighting",
    sub: "crowds leaving a gig nearby",
    location: "Pitch card: the events line",
    how: "combined",
    with: ["Ticketmaster"],
  },
  { id: "f_crowd", label: "Crowd panel", sub: "who this crowd likes, and why", location: "Plan page: the crowd panel", how: "direct" },
  {
    id: "f_fans",
    label: "Fans vs the usual crowd",
    sub: "what sets your crowd apart",
    location: "Crowd panel: “Your fans vs the usual crowd”",
    how: "diff",
    with: ["your fans", "the usual crowd"],
  },
  {
    id: "f_setlist",
    label: "Set and songs to learn",
    sub: "what to play, what to learn",
    location: `Pitch card: the ${PLAYLIST_COPY.suggestedSetNoun}, and ${PLAYLIST_COPY.toLearn}`,
    how: "combined",
    with: ["Last.fm", "Spotify"],
  },
  {
    id: "f_plain",
    label: "Plain-AI comparison",
    sub: "its spots scored on Qloo data",
    location: "Plan page: Busk Map vs a plain AI",
    how: "diff",
    with: ["a plain AI", "Busk Map"],
  },
  { id: "f_agent", label: "The agent’s tools", sub: "what Claude asks while it plans", location: "Plan page: Agent steps", how: "direct" },
  {
    id: "f_learn",
    label: PLAYLIST_COPY.toLearn,
    sub: "a scouting run",
    location: `${PLAYLIST_COPY.name} page: ${PLAYLIST_COPY.toLearnShort}`,
    how: "combined",
    with: ["Spotify", "Last.fm", "Claude Sonnet (the learn agent)"],
  },
];

/** Planned, not built (docs/qloo-data-map.md §3). Only items with built: false. */
export const next: readonly NextItem[] = [
  { id: "genre-signals", label: "Taste from genres as well as artists, for the taste map", built: false },
  { id: "genre-search", label: "Searching Qloo’s genre list directly", built: false },
  { id: "nearest-locality", label: "A nearest-neighbourhood retry when a city area comes back empty", built: false },
];

/** Kinds of Qloo call: every call except variants (5b is call 5 without an interest signal). */
export const callKinds = calls.filter((c) => !c.variantOf).length;
export const featureCount = features.length;
export const dataPointCount = dataPoints.length;

/** Measured, not derivable (docs/qloo-data-map.md §4): live 28–32 (24–28 before the local scene, plus its 4), mock 37; plus one (#9b) when the act has an own artist, not counted in this range; a rerun is served from the cache. */
export const CALLS_PER_NEW_BUSK = "28–37";
export const CALLS_ON_RERUN = 0;
/** A learn run's hard cap (config.ts:LEARN_QLOO_BUDGET): typically 8–9 requests, 25 at worst (docs/playlist-architecture.md §2.9). */
export const CALLS_PER_LEARN_RUN = "≤ 25";

export const QUOTA = {
  requestsPerMonth: 10_000,
  requestsPerSecond: 5,
  pacedPerSecond: 3,
  cacheHours: 24,
} as const;

export const facts: readonly { value: string; label: string }[] = [
  { value: String(callKinds), label: "kinds of Qloo call" },
  { value: CALLS_PER_NEW_BUSK, label: "Qloo calls for a new busk" },
  { value: String(CALLS_ON_RERUN), label: `on a rerun: answers cached for ${QUOTA.cacheHours} h` },
  { value: String(featureCount), label: "parts of your busk it decides" },
  { value: CALLS_PER_LEARN_RUN, label: "Qloo calls per learn run" },
];

export const quotaNote =
  `Qloo allows ${QUOTA.requestsPerMonth.toLocaleString("en-AU")} requests a month per key, at ${QUOTA.requestsPerSecond} a second. ` +
  `Busk Map paces its calls to ${QUOTA.pacedPerSecond} a second and caches every answer for ${QUOTA.cacheHours} h, ` +
  `so a key covers roughly 270–360 new busks a month, and reruns are free.`;

// ---- The graph -----------------------------------------------------------

export type Edge = { from: NodeId; to: NodeId; how: string };

export const edges: readonly Edge[] = [
  ...calls.flatMap((c) => c.dataPoints.map((d) => ({ from: c.id, to: d.id, how: d.how }))),
  ...secondarySources.flatMap((s) => s.dataPoints.map((d) => ({ from: s.id, to: d.id, how: d.how }))),
  ...dataPoints.flatMap((p) => p.features.map((f) => ({ from: p.id, to: f.id, how: f.how }))),
];

type AnyNode = { id: NodeId; label: string };
const kindOf = new Map<NodeId, NodeKind>([
  ...calls.map((c) => [c.id, "call"] as const),
  ...secondarySources.map((s) => [s.id, "source"] as const),
  ...dataPoints.map((d) => [d.id, "dataPoint"] as const),
  ...features.map((f) => [f.id, "feature"] as const),
]);
const nodeById = new Map<NodeId, AnyNode>([...calls, ...secondarySources, ...dataPoints, ...features].map((n) => [n.id, n]));

export function nodeKind(id: NodeId): NodeKind {
  return kindOf.get(id)!;
}

export function nodeLabel(id: NodeId): string {
  return nodeById.get(id)!.label;
}

export function isNodeId(id: string): id is NodeId {
  return kindOf.has(id as NodeId);
}

/** Features a secondary source reaches, through its data points. */
export function featuresTouchedBy(source: SourceId): FeatureId[] {
  return [...trace(source).nodes].filter((id): id is FeatureId => nodeKind(id) === "feature");
}

export type Trace = { nodes: ReadonlySet<NodeId>; edges: ReadonlySet<number> };

/** Everything downstream and upstream of one node: the node, every node on its paths, and those edges (by index). */
export function trace(id: NodeId): Trace {
  const nodes = new Set<NodeId>([id]);
  const hit = new Set<number>();
  const walk = (from: NodeId, down: boolean) => {
    edges.forEach((e, i) => {
      const [a, b] = down ? [e.from, e.to] : [e.to, e.from];
      if (a !== from || hit.has(i)) return;
      hit.add(i);
      nodes.add(b);
      walk(b, down);
    });
  };
  walk(id, true);
  walk(id, false);
  return { nodes, edges: hit };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const list = (parts: string[]) => (parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`);

/** One sentence for the trace: where the picked piece comes from and what it decides. */
export function traceSummary(id: NodeId): string {
  const { nodes } = trace(id);
  const count = (kind: NodeKind) => [...nodes].filter((n) => n !== id && nodeKind(n) === kind).length;
  const kind = nodeKind(id);
  const up = [
    count("call") && plural(count("call"), "Qloo call", "Qloo calls"),
    count("source") && plural(count("source"), "other source", "other sources"),
    kind === "feature" && plural(count("dataPoint"), "data point", "data points"),
  ].filter((p): p is string => Boolean(p));
  const down = [
    kind !== "dataPoint" && kind !== "feature" && plural(count("dataPoint"), "data point", "data points"),
    kind !== "feature" && plural(count("feature"), "part of your busk", "parts of your busk"),
  ].filter((p): p is string => Boolean(p));
  const clauses = [up.length ? `comes from ${list(up)}` : "", down.length ? `feeds ${list(down)}` : ""].filter(Boolean);
  return `${nodeLabel(id)} ${clauses.join(", and ")}.`;
}
