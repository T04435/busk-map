/**
 * Every user-facing word about the Repertoire (docs/playlist-architecture.md §4.1). Client-safe.
 * Code names stay `playlist`; a later rename ("Songbook") is an edit to this one file.
 */
const USE_MINE = "Use my Repertoire";

export const PLAYLIST_COPY = {
  name: "Repertoire",
  canSing: "Songs you can sing",
  toLearn: "Songs to learn",
  learned: "Learned",
  suggestedSet: "Suggested set",
  addTo: "Add to Repertoire",
  useMine: USE_MINE,
  findToLearn: "Find songs to learn",
  findMore: "Find more songs to learn",
  newThisRun: "New this run",
  saveAs: "Save as my Repertoire",
  saveChanges: "Save these changes to my Repertoire",
  editedForBusk: "Edited for this busk",
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
  forgetConfirm: "Delete your Repertoire from this device and our server? This can't be undone.",
  forgotten: "Your Repertoire was deleted.",
  loading: "Loading your Repertoire…",

  // On the busk form, the week page and the plan (S2)
  mineWithCount: (n: number) => `${USE_MINE} (${n} ${n === 1 ? "song" : "songs"})`,
  fromRepertoire: "From your Repertoire",
  editedHint: "Changes below are for this busk only until you save them.",
  saveThese: "Save these songs as your Repertoire",
  saveTheseHint: "Keep them on this device so the next busk starts with them. Nothing is saved unless you choose to.",
  saving: "Saving…",
  saved: "Saved to your Repertoire.",
  reload: "Reload",
  addedToLearn: "Added to Songs to learn.",
  addedFromPlans: "Added from plans",
  adding: "Adding…",
  weekToggleHint: "Plan the week with your Repertoire's songs and artists.",

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
    tooMany: "You've made a lot of Repertoires from this network. Try again in a little while.",
    unavailable: "Saving isn't available right now. You can still plan without a Repertoire.",
    network: "We couldn't reach the server. Try again.",
    bot: "This request looked automated. Reload the page and try again.",
  },

  // Songs to learn: a learn run's words (docs §7). Errors first; the page copy follows.
  learn: {
    /** The status line at the end of a run (docs §7.2 `end.message`), the same live and on replay. */
    end: (e: { ok: boolean; mode: "agent" | "fallback" | "mock" | "none"; code: string | null; newCount: number; skippedCount: number }): string => {
      const songs = (n: number) => `${n} ${n === 1 ? "song" : "songs"}`;
      if (!e.ok) {
        if (e.code === "qloo_unavailable") return "Suggestions need Qloo's taste data, and Qloo isn't answering right now. Try again in a little while.";
        if (e.code === "no_match") return "Qloo couldn't match your artists, so there is nothing to learn from yet. Add songs by better-known artists and try again.";
        if (e.code === "timeout") return "The run ran out of time before it found songs. Try again.";
        return "The run stopped before it found songs. Try again in a little while.";
      }
      if (e.code === "nothing_new" || e.newCount === 0) return `No new songs this time: everything we found was suggested before${e.skippedCount ? ` (${songs(e.skippedCount)} left out)` : ""}.`;
      const left = e.skippedCount ? ` Left out ${songs(e.skippedCount)} you already know or had in earlier runs.` : "";
      if (e.mode === "fallback") {
        const why = e.code === "timeout" ? "The AI ran out of time" : e.code === "stopped" ? "The AI reached its step limit" : "The AI was unavailable";
        return `${why}, so these ${songs(e.newCount)} come from the data alone.${left}`;
      }
      const by = e.mode === "mock" ? "The test model" : "Claude";
      return `${by} found ${songs(e.newCount)} to learn.${left}`;
    },
    errors: {
      suggestionNotFound: "That song isn't on your list any more. Reload to see the latest.",
      badMove: "That change isn't possible for this song.",
      noRepertoire: "Save your Repertoire first, then find songs to learn.",
      unavailable: "Songs to learn isn't available right now. Try again in a little while.",
      notHere: "This run is going on another server. Its songs appear in your list when it finishes.",
      runNotFound: "That run isn't in your list any more.",
      emptyPlaylist: (min: number) => `Add at least ${min} songs you can sing, then find songs to learn.`,
      listFull: (max: number) => `Your list of songs to learn is full (${max}). Mark some learned or dismiss them first.`,
    },
  },
} as const;
