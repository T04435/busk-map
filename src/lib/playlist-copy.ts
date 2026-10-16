/**
 * Every user-facing word about the Repertoire (docs/playlist-architecture.md §4.1). Client-safe.
 * Code names stay `playlist`; a later rename ("Songbook") is an edit to this one file.
 */
const USE_MINE = "Use my Repertoire";
const CAN_SING = "Songs you can sing";

export const PLAYLIST_COPY = {
  name: "Repertoire",
  canSing: CAN_SING,
  toLearn: "Songs you should learn",
  learned: "Learned",
  suggestedSet: "Suggested set",
  /** The short name inside the Repertoire page ("Songs to learn" is the plan's section and the page heading). */
  toLearnShort: "To learn",
  /** Lower-case nouns for running text. */
  suggestedSetNoun: "suggested set",
  toLearnNoun: "songs to learn",
  suggestedSetFor: (pitch: string) => `Suggested set for ${pitch}`,
  suggestedSetEmpty: "Add songs you can play to get a suggested set.",
  suggestedSetStepLabel: "Suggested set for a pitch",
  toLearnStepLabel: "Songs you should learn",
  addTo: "Add to Repertoire",
  useMine: USE_MINE,
  findToLearn: "Find songs to learn",
  findMore: "Find more songs to learn",
  newThisRun: "New this run",
  saveAs: "Save as my Repertoire",
  inRepertoire: "In your Repertoire",
  link: "Repertoire",

  // The Repertoire page (S1)
  pageTitle: "Your Repertoire",
  pageIntro: "The songs you can sing, kept on this device. Plan a busk and your suggested set comes from them.",
  deviceNote: "Saved on this device only. Clearing this browser's site data loses it.",
  searchLabel: "Add a song",
  typedLabel: "Or type one in",
  typedPlaceholder: "Title - Artist",
  typedAdd: "Add song",
  empty: "No songs yet. Add the first one and your Repertoire is saved.",
  emptyLearned: "Songs you learn from suggestions show up here.",
  remove: "Remove",
  moveToCanSing: "Move to Songs you can sing",
  yourSong: "Your song",
  count: (n: number, max: number) => `${n} of ${max} songs`,
  forget: "Forget my Repertoire",
  forgetTitle: "Forget your Repertoire?",
  forgetConfirm: "This deletes your Repertoire from this device and our server. It can't be undone.",
  forgetCancel: "Keep it",
  forgetAction: "Delete my Repertoire",
  forgotten: "Your Repertoire was deleted.",
  loading: "Loading your Repertoire…",

  // On the busk form and the plan (S2)
  mineWithCount: (n: number) => `${USE_MINE} (${n} ${n === 1 ? "song" : "songs"})`,
  fromRepertoire: "From your Repertoire",
  saveThese: "Save these songs as your Repertoire",
  saveTheseHint: "Keep them on this device so the next busk starts with them. Nothing is saved unless you choose to.",
  saving: "Saving…",
  saved: "Saved to your Repertoire.",
  addedToLearn: "Added to Songs you should learn.",
  addedFromPlans: "Added from plans",
  adding: "Adding…",

  // The busk form's read-only Repertoire block (RepertoireSource)
  source: {
    heading: "Your Repertoire",
    headingLastBusk: "Songs from your last busk",
    summary: (n: number, length: string | null) => `${n} ${n === 1 ? "song" : "songs"}${length ? ` · about ${length}` : ""}`,
    edit: "Edit in your Repertoire",
    create: "Create your Repertoire",
    empty: "No Repertoire yet",
    emptyHint: "You can still plan: Busk Map suggests songs for each crowd.",
  },

  // The act (name, artists you sound like, Spotify profile) kept in the Repertoire
  act: {
    heading: "Your act",
    intro: "Your act name and the artists you sound like. The busk form starts with them, so you aren't asked every time.",
    savePage: "Save act details",
    back: "Back to my Repertoire",
    savedPage: "Act details saved.",
  },
  profile: {
    refresh: "Refresh my songs",
    heading: "Your Spotify profile",
    refreshProfile: "Refresh profile",
    loadProfile: "Load my Spotify profile",
    refreshing: "Refreshing your profile…",
    refreshed: "Profile refreshed.",
    followers: (n: number) => `${n.toLocaleString("en-AU")} ${n === 1 ? "follower" : "followers"}`,
    notFound: "Spotify has no artist at that link, so there is no profile to show.",
    spotifyDown: "Spotify isn't answering right now. Your saved profile is unchanged. Try Refresh in a minute.",
  },
  soundsLike: {
    heading: "Suggested: artists you sound like",
    intro: "From fans of your music on Qloo. Add the ones that fit; nothing changes until you add them.",
    add: "Add",
    addAll: "Add all",
    loading: "Looking for artists you sound like…",
    unknown: "Qloo doesn't know this artist yet, so there are no suggestions.",
    unavailable: "Couldn't load suggestions right now. Refresh your profile to try again.",
  },

  // Friendly errors
  errors: {
    invalid: "That song couldn't be read. Check the title and artist and try again.",
    typedFormat: "Type it as Title - Artist.",
    duplicate: "That song is already in your Repertoire.",
    inRepertoire: "In your Repertoire already.",
    alreadySuggested: "Already on your list of songs to learn.",
    full: (max: number) => `Your Repertoire holds ${max} songs. Remove one to add another.`,
    stale: "Your Repertoire changed in another tab. Reload to see the latest.",
    notFound: "That song isn't in your Repertoire any more.",
    rateLimited: "Too many requests in a short time. Wait a moment and try again.",
    tooMany: "You've made a lot of Repertoires from this network. Try again in a little while.",
    unavailable: "Saving isn't available right now. You can still plan without a Repertoire.",
    network: "We couldn't reach the server. Try again.",
    bot: "This request looked automated. Reload the page and try again.",
  },

  // Songs to learn: a learn run's words (docs §7). Errors first; the page copy follows.
  learn: {
    /** The status line at the end of a run (docs §7.2 `end.message`), the same live and on replay. */
    end: (e: { ok: boolean; mode: "agent" | "fallback" | "mock" | "none"; code: string | null; newCount: number; skippedCount: number; songsChecked?: number }): string => {
      const songs = (n: number) => `${n} ${n === 1 ? "song" : "songs"}`;
      if (!e.ok) {
        if (e.code === "qloo_unavailable") return "Suggestions need Qloo's taste data, and Qloo isn't answering right now. Try again in a little while.";
        if (e.code === "no_match") return "Qloo couldn't match your artists, so there is nothing to learn from yet. Add songs by better-known artists and try again.";
        if (e.code === "timeout") return "The run ran out of time before it found songs. Try again.";
        return "The run stopped before it found songs. Try again in a little while.";
      }
      if (e.code === "nothing_new" || e.newCount === 0) {
        // B-029: "everything was suggested before" only when songs were checked; with none checked, say that instead.
        if (e.songsChecked === 0) return `Couldn't find songs to check this time. ${PLAYLIST_COPY.learn.nothingNewHint}`;
        return `Nothing new this time${e.skippedCount ? ` (${e.skippedCount} left out)` : ""}. ${PLAYLIST_COPY.learn.nothingNewHint}`;
      }
      const left = e.skippedCount ? ` Left out ${songs(e.skippedCount)} you already know or had in earlier runs.` : "";
      if (e.mode === "fallback") {
        const why = e.code === "timeout" ? "The AI ran out of time" : e.code === "stopped" ? "The AI reached its step limit" : "The AI was unavailable";
        return `${why}, so these ${songs(e.newCount)} come from the data alone.${left}`;
      }
      const by = e.mode === "mock" ? "The test model" : "Claude";
      return `${by} found ${songs(e.newCount)} to learn.${left}`;
    },
    runStarted: "Looking for songs to learn",
    replaying: (n: number) => `Replaying run ${n} from your list (stored steps, no new model call)`,
    stepsPruned: "This run's steps are no longer kept. Its songs are still on your list.",

    // The Songs to learn section of the Repertoire page (docs §7.4)
    intro: "Find songs to learn from the artists your fans, and the crowds where you busk, like. Each run looks at your Repertoire, takes about 30 seconds, and never suggests a song twice.",
    firstTime: "No runs yet. Press the button and we'll look for songs you could learn next.",
    runsLeft: (n: number) => `${n} ${n === 1 ? "run" : "runs"} left this hour`,
    lastRun: (when: string, n: number) => `Last run ${when}: ${n} new ${n === 1 ? "song" : "songs"}.`,
    running: "Looking for songs to learn…",
    starting: "Starting a run",
    runningHint: "The steps appear below as they happen. You can leave this page: the run carries on and its songs will be on your list.",
    finding: "Finding songs…",
    needSongs: (min: number) => `Add at least ${min} songs you can sing, then find songs to learn.`,
    needRepertoire: "Save your Repertoire by adding a song above, then find songs to learn.",
    /** The run limit's words (docs §2.10): relative, and the network's version doesn't blame the performer. */
    limitMessage: (scope: "repertoire" | "ip", minutes: number, max = 3): string => {
      const wait = `Try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
      return scope === "repertoire" ? `You've started ${max} runs this hour. ${wait}` : `A lot of runs have started from this network in the last hour. ${wait}`;
    },
    limitTitle: { repertoire: "Run limit reached", ip: "Lots of runs from this network" },
    qlooDownTitle: "Qloo isn't answering",
    fallbackTitle: "Picked from the data alone",
    errorTitle: "The run didn't finish",
    nothingNewTitle: "Nothing new this time",
    nothingNewHint: "Try again after a new busk, or after you've learned a few songs.",
    /** After a Qloo outage or any run that didn't finish (sketch §1 error row). */
    songsSafe: "Your songs are safe.",
    /** Only for runs the limit doesn't count (Qloo down, no match). */
    notCounted: "This run didn't count towards your limit.",
    retry: "Try again",
    runHeading: (n: number) => `Run ${n}`,
    stepsHeading: "Steps",
    showSteps: "Show steps",
    hideSteps: "Hide steps",
    replay: "Replay steps",
    replayLoading: "Loading the steps…",
    replayFailed: "The steps couldn't be loaded.",
    earlierRuns: "Earlier runs",
    looked: (songs: number, pitches: number) => `looked at ${songs} ${songs === 1 ? "song" : "songs"}${pitches ? `, ${pitches} ${pitches === 1 ? "pitch" : "pitches"}` : ""}`,
    newCount: (n: number) => `${n} new`,
    modelLabel: { claude: "Claude", mock: "test model", template: "from the data" },
    statusLabel: { running: "running", done: "done", fallback: "from the data", failed: "didn't finish" },
    learnedBtn: "Mark as learned",
    notForMe: "Not for me",
    undo: "Undo",
    learnedBadge: "Learned",
    showRaw: "Show raw data",
    howFound: "How we found these songs",
    dismissedGroup: (n: number) => `Not for me (${n})`,
    movedToSung: (title: string) => `${title} is now in ${CAN_SING}.`,
    dismissedDone: (title: string) => `${title} won't be suggested again. Undo it from Not for me.`,
    undone: (title: string) => `${title} is back on your list.`,
    buildsOn: (title: string) => `Builds on ${title}`,
    crowdAt: (pitch: string) => `Crowd at ${pitch}`,
    /** Qloo's audience growth is usually 0 live, so the label carries no number. */
    growth: "Growing with your crowds",
    /** `trendDelta`: percentile points gained in Qloo's population percentile over the trending window. */
    rising: (pts: number) => `${pts > 0 ? "+" : ""}${Math.round(pts * 10) / 10} pts with your crowds`,
    source: { spotify: "Spotify", lastfm: "Last.fm", plan: "Added from a plan" },
    learnIt: "Learn it",
    totals: {
      artists: "artists matched",
      crowds: "crowds read",
      liked: "artists liked",
      songsChecked: "songs checked",
      alreadySuggested: "suggested before",
      dismissedSkipped: "you dismissed",
      alreadyKnown: "you already sing",
      newSongs: "new songs",
      qlooCalls: "Qloo requests",
      qlooCacheHits: "Qloo answers from cache",
    },
    totalsHeading: "What this run looked at",
    errors: {
      suggestionNotFound: "That song isn't on your list any more. Reload to see the latest.",
      badMove: "That change isn't possible for this song.",
      noRepertoire: "Save your Repertoire first, then find songs to learn.",
      unavailable: "Songs to learn isn't available right now. Try again in a little while.",
      notHere: "This run is going on another server. Its songs appear in your list when it finishes.",
      runNotFound: "That run isn't in your list any more.",
      emptyPlaylist: (min: number) => `Add at least ${min} songs you can sing, then find songs to learn.`,
      alreadyRunning: "A run is already going. Its steps are on this page.",
      listFull: (max: number) => `Your list of songs to learn is full (${max}). Mark some learned or dismiss them first.`,
    },
  },
} as const;
