/**
 * The view model of a Repertoire research run (spec: repertoire-research-spec.md, 17 Oct). Presentational only: DEV maps the
 * stream events and the saved snapshot onto these shapes; the honeycomb/repertoire components draw them.
 */

/** The ten steps, in order. */
export type RepertoireStepKey = "profile" | "songs" | "qloo" | "soundsLike" | "fans" | "fansMap" | "fansLove" | "learn" | "genres" | "summary";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type RepertoireStep = {
  key: RepertoireStepKey;
  status: StepStatus;
  /** One plain-words line on what this step found, once it has ("12 of your songs, from 3 releases"). */
  found?: string | null;
  /** Up to 6 small cells previewing what it found (artist photos or initials, song covers). */
  cells?: { name: string; image?: string | null }[];
  /** Why it failed or was skipped, in plain words. */
  note?: string | null;
};

/** The running counts behind the research funnel. */
export type RepertoireTotals = {
  qlooCalls: number;
  songs: number;
  soundsLike: number;
  fanArtists: number;
  songsChecked: number;
  /** The output: songs to learn picked. Null while still choosing. */
  toLearn: number | null;
};

export type ResearchArtist = {
  name: string;
  image?: string | null;
  source?: "spotify" | "qloo" | "typed";
  tags?: string[];
};

export type ResearchSong = {
  id: string;
  title: string;
  artist: string;
  year?: number | null;
  album?: string | null;
  image?: string | null;
  durationMs?: number | null;
  /** A Spotify track link. */
  href?: string | null;
  own?: boolean;
};

export type LearnSong = ResearchSong & {
  /** "Fans of Angus & Julia Stone and The Paper Kites love this." */
  reason: string;
  /** Fan artists behind the pick, for the evidence cells. */
  because?: ResearchArtist[];
  status: "pending" | "learned" | "dismissed";
  /** Picked in the newest run. */
  fresh?: boolean;
};

export type FanLean = { label: string; lean: number };

export type RepertoireProfile = {
  name: string;
  image?: string | null;
  genres: string[];
  /** Qloo audience character tags ("Youthful", "Energetic"). */
  audience: string[];
  followers?: number | null;
  /** A Spotify artist link. */
  href?: string | null;
};

export type RepertoireResults = {
  profile: RepertoireProfile | null;
  /** Claude's one plain paragraph: who you are and who your crowd is. */
  summary: string | null;
  fans: { age: FanLean[]; gender: FanLean[] } | null;
  soundsLike: ResearchArtist[] | null;
  /** Fan artists you don't already sound like (step 6). */
  fansLove: ResearchArtist[] | null;
  canSing: ResearchSong[] | null;
  toLearn: LearnSong[] | null;
  learned: ResearchSong[] | null;
};
