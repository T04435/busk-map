/**
 * Every user-facing word about the Repertoire (docs/playlist-architecture.md §4.1). Client-safe.
 * Code names stay `playlist`; a later rename ("Songbook") is an edit to this one file.
 */
export const PLAYLIST_COPY = {
  name: "Repertoire",
  canSing: "Songs you can sing",
  toLearn: "Songs to learn",
  learned: "Learned",
  suggestedSet: "Suggested set",
  addTo: "Add to Repertoire",
  useMine: "Use my Repertoire",
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

  // Friendly errors
  errors: {
    invalid: "That song couldn't be read. Check the title and artist and try again.",
    typedFormat: "Type it as Title - Artist.",
    duplicate: "That song is already in your Repertoire.",
    full: (max: number) => `Your Repertoire holds ${max} songs. Remove one to add another.`,
    stale: "Your Repertoire changed in another tab. Reload to see the latest.",
    notFound: "That song isn't in your Repertoire any more.",
    tooMany: "You've made a lot of Repertoires from this network. Try again in a little while.",
    unavailable: "Saving isn't available right now. You can still plan without a Repertoire.",
    network: "We couldn't reach the server. Try again.",
    bot: "This request looked automated. Reload the page and try again.",
  },
} as const;
