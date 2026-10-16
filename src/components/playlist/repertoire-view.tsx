"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { RepertoireAdd } from "./repertoire-add";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/live-search";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";
import { playlistSongKey, type PlaylistSongView, type PlaylistView } from "@/lib/playlist-schema";
import { LearnPanel } from "./learn-panel";
import { addSong, createPlaylist, forgetPlaylist, loadPlaylist, moveSong, refreshProfile, removeSong, savePlaylist, type PlaylistResult, type ProfileRefreshOutcome } from "./playlist-api";
import { ProfileHeader } from "./profile-header";
import { SoundsLikeSuggestionsList, withSuggested } from "./sounds-like-suggestions";
import { ArtistPicker, typedArtists, type PickedArtist } from "@/components/landing/artist-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { draftOf, repertoireDraft, sameDraft } from "@/lib/repertoire-prefill";

const NO_ARTISTS: never[] = [];
/** The song search box: the field to land on when a list empties. */
const ADD_FIELD = "add-field";
const ADD_FIELD_SELECTOR = 'section[aria-labelledby="add-heading"] input[role="combobox"]';

/** The action to focus when `id` leaves `rows`: the next row's, else the previous row's, else the add field. */
function focusTargetAfter(rows: PlaylistSongView[], id: string, action: "remove" | "move"): string {
  const i = rows.findIndex((r) => r.id === id);
  const near = rows[i + 1] ?? rows[i - 1];
  return near ? `${action}-${near.id}` : ADD_FIELD;
}

function SongRow({ song, children }: { song: PlaylistSongView; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{song.title}</span>
        <span className="block truncate text-sm text-muted-foreground">{song.artist}</span>
      </span>
      {song.own && <Badge variant="secondary">{COPY.yourSong}</Badge>}
      {song.durationMs !== null && <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatDuration(song.durationMs)}</span>}
      <span className="flex gap-2">{children}</span>
    </li>
  );
}

/** The Repertoire page: Songs you can sing and Learned, with add, remove and move. Plain shadcn; the look comes later. */
export function RepertoireView() {
  const [playlist, setPlaylist] = useState<PlaylistView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  // The act fields: edited here, written only by "Save act details".
  const [actName, setActName] = useState("");
  const [actArtists, setActArtists] = useState<PickedArtist[]>([]);
  const [artistQuery, setArtistQuery] = useState("");
  // Where focus goes once a row is gone (B-016): the next row's action, the previous one's, or the add field.
  const focusAfter = useRef<string | null>(null);

  function fillAct(view: PlaylistView) {
    setActName(view.actName ?? "");
    setActArtists(view.soundsLike.map((a): PickedArtist => ({ name: a.name, spotifyId: a.spotifyId ?? null, image: null })));
    setArtistQuery("");
  }

  useEffect(() => {
    let live = true;
    loadPlaylist().then((result) => {
      if (!live) return;
      if (result.ok) {
        setPlaylist(result.playlist);
        if (result.playlist) fillAct(result.playlist);
      } else setMessage({ kind: "error", text: result.message });
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const target = focusAfter.current;
    if (!target || busy) return; // buttons are disabled while a request runs
    focusAfter.current = null;
    const el = target === ADD_FIELD ? document.querySelector<HTMLElement>(ADD_FIELD_SELECTOR) : document.querySelector<HTMLElement>(`[data-focus-id="${target}"]`);
    el?.focus();
  }, [playlist, busy]);

  const apply = useCallback((result: PlaylistResult, info?: string) => {
    if (result.ok) {
      setPlaylist(result.playlist);
      setMessage(info ? { kind: "info", text: info } : null);
      return true;
    }
    setMessage({ kind: "error", text: result.message });
    return false;
  }, []);

  // A song marked learned (or its Undo) changes Songs you can sing: reload them and the revision.
  const refreshPlaylist = useCallback(() => {
    void loadPlaylist().then((result) => {
      if (result.ok) setPlaylist(result.playlist);
    });
  }, []);

  const songs = useMemo(() => playlist?.songs ?? [], [playlist]);
  const canSing = songs.filter((s) => s.state === "can_sing");
  const learned = songs.filter((s) => s.state === "learned");
  const keys = useMemo(() => new Set(songs.map((s) => playlistSongKey(s.artist, s.title))), [songs]);
  const max = playlist?.maxSongs ?? 60;

  async function run(action: () => Promise<PlaylistResult>, info?: string) {
    setBusy(true);
    try {
      const ok = apply(await action(), info);
      if (!ok) focusAfter.current = null;
      return ok;
    } finally {
      setBusy(false);
    }
  }

  const trackSong = (track: TrackResult) => ({
    title: track.title,
    artist: track.artists[0]?.name ?? "Unknown artist",
    source: "spotify" as const,
    spotifyTrackId: /^[A-Za-z0-9]{22}$/.test(track.id) ? track.id : undefined,
    ...(track.durationMs ? { durationMs: track.durationMs } : {}),
  });

  /** Spotify has no match: the typed fallback under the search. Saved as typed, so no length. */
  async function addTyped(song: { title: string; artist: string }) {
    return run(() => addSong({ ...song, source: "typed" }), `Added ${song.title}.`);
  }

  /** The songs on the artist's own Spotify profile, tagged Your song. One at a time; the first refusal (full, duplicate) stops it. */
  async function addOwn(tracks: TrackResult[]) {
    let count = 0;
    for (const track of tracks) {
      if (keys.has(playlistSongKey(track.artists[0]?.name ?? "Unknown artist", track.title))) continue;
      const ok = await run(() => addSong({ ...trackSong(track), own: true }));
      if (!ok) break;
      count++;
    }
    if (count > 0) setMessage({ kind: "info", text: `Added ${count} of your songs.` });
  }

  const chosenArtists = () => {
    const chosen = [...actArtists];
    for (const typed of typedArtists(artistQuery)) if (!chosen.some((a) => a.name.toLowerCase() === typed.toLowerCase())) chosen.push({ name: typed, spotifyId: null, image: null });
    return chosen.slice(0, 10);
  };
  const actEdited = !sameDraft(
    draftOf({ name: actName.replace(/\s+/g, " ").trim(), artists: chosenArtists().map((a) => a.name), songs: [] }),
    repertoireDraft({ actName: playlist?.actName ?? null, soundsLike: playlist?.soundsLike ?? [], songs: [] }),
  );

  /** The only thing here that writes the act: an explicit save, checked against the revision last seen (a first save creates the Repertoire). */
  async function saveAct() {
    const act = {
      actName: actName.replace(/\s+/g, " ").trim() || null,
      soundsLike: chosenArtists().map((a) => ({ name: a.name, ...(a.spotifyId ? { spotifyId: a.spotifyId } : {}) })),
    };
    const ok = await run(() => (playlist ? savePlaylist({ revision: playlist.revision, ...act }) : createPlaylist(act)), COPY.act.savedPage);
    if (ok) setArtistQuery("");
  }

  /** Says what a profile refresh did, when it was not plain success. */
  function profileNote(outcome: ProfileRefreshOutcome) {
    if (!outcome.ok) return setMessage({ kind: "error", text: outcome.message });
    if (outcome.spotify === "not_found") return setMessage({ kind: "error", text: COPY.profile.notFound });
    if (outcome.spotify === "unavailable") return setMessage({ kind: "error", text: COPY.profile.spotifyDown });
  }

  /** Loads the Spotify artist and finds it in Qloo, for the saved link. Only on a link change or Refresh, never on page load. */
  async function refreshNow() {
    setProfileBusy(true);
    try {
      const outcome = await refreshProfile();
      if (outcome.ok) setPlaylist(outcome.playlist);
      profileNote(outcome);
      if (outcome.ok && outcome.spotify === "ok") setMessage({ kind: "info", text: COPY.profile.refreshed });
    } finally {
      setProfileBusy(false);
    }
  }

  /** The Spotify profile link was changed and its songs loaded: keep it in the Repertoire so it is never asked again, and load the profile once. */
  async function saveProfile(id: string | null) {
    const current = await loadPlaylist();
    if (!current.ok) return;
    const saved = await (current.playlist ? savePlaylist({ revision: current.playlist.revision, spotifyArtistId: id }) : createPlaylist({ spotifyArtistId: id }));
    // Quietly: the "Added N of your songs" line from the load stays on screen.
    if (!saved.ok) return;
    setPlaylist(saved.playlist);
    setProfileBusy(true);
    try {
      const outcome = await refreshProfile();
      if (outcome.ok) setPlaylist(outcome.playlist);
      profileNote(outcome);
    } finally {
      setProfileBusy(false);
    }
  }

  async function forget() {
    await run(() => forgetPlaylist(), COPY.forgotten);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="m-0 font-display text-[clamp(44px,6vw,72px)] leading-[0.92] font-extrabold uppercase">{COPY.pageTitle}</h1>
        <p className="text-muted-foreground">{COPY.pageIntro}</p>
        <p className="text-sm text-muted-foreground">{COPY.deviceNote}</p>
      </header>

      <div role="status" aria-live="polite" className="empty:hidden">
        {message?.kind === "info" && <p className="text-sm">{message.text}</p>}
      </div>
      {message?.kind === "error" && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {loaded && playlist && <ProfileHeader profile={playlist.spotifyProfile} hasLink={Boolean(playlist.spotifyArtistId)} busy={profileBusy} onRefresh={() => void refreshNow()} />}

      <section aria-labelledby="act-heading" className="max-w-2xl space-y-4" data-testid="act-profile">
        <h2 id="act-heading" className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
          {COPY.act.heading}
        </h2>
        <p className="text-sm text-muted-foreground">{COPY.act.intro}</p>
        <div className="space-y-1.5">
          <Label htmlFor="name">Act name</Label>
          <Input id="name" value={actName} onChange={(e) => setActName(e.target.value)} placeholder="e.g. Jess on acoustic guitar" maxLength={80} />
        </div>
        <ArtistPicker value={actArtists} onChange={setActArtists} query={artistQuery} onQueryChange={setArtistQuery} />
        <SoundsLikeSuggestionsList
          enabled={loaded && Boolean(playlist?.spotifyArtistId)}
          refreshKey={`${playlist?.qlooArtistId ?? ""}|${playlist?.spotifyProfile?.fetchedAt ?? ""}`}
          picked={chosenArtists().map((a) => a.name)}
          onAdd={(add) => setActArtists((current) => withSuggested(current, add))}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy || !actEdited} onClick={() => void saveAct()}>
            {COPY.act.savePage}
          </Button>
          {actEdited && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => playlist ? fillAct(playlist) : (setActName(""), setActArtists([]), setArtistQuery(""))}>
              {COPY.act.back}
            </Button>
          )}
        </div>
      </section>

      <Separator />

      <section aria-labelledby="add-heading" className="max-w-2xl space-y-4">
        <h2 id="add-heading" className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
          {COPY.searchLabel}
        </h2>
        <RepertoireAdd
          key={loaded ? "loaded" : "loading"}
          profileId={playlist?.spotifyArtistId ?? null}
          onProfileChange={(id) => void saveProfile(id)}
          artists={NO_ARTISTS}
          isAdded={(track) => keys.has(playlistSongKey(track.artists[0]?.name ?? "Unknown artist", track.title))}
          onAddTrack={(track) => void run(() => addSong(trackSong(track)), `Added ${track.title}.`)}
          onAddTyped={addTyped}
          onAddOwn={addOwn}
        />
      </section>

      <Separator />

      {!loaded ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only" role="status">
            {COPY.loading}
          </p>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-12 w-full max-w-2xl" />
        </div>
      ) : (
        <>
          <section aria-labelledby="can-sing-heading" className="max-w-2xl space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="can-sing-heading" className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
                {COPY.canSing}
              </h2>
              <span className="text-sm text-muted-foreground tabular-nums">{COPY.count(songs.length, max)}</span>
            </div>
            {canSing.length === 0 ? (
              <p className="text-sm text-muted-foreground">{COPY.empty}</p>
            ) : (
              <ul aria-label={COPY.canSing} className="m-0 list-none divide-y divide-border border-2 border-rule bg-card px-3">
                {canSing.map((song) => (
                  <SongRow key={song.id} song={song}>
                    <Button variant="outline" size="sm" disabled={busy} data-focus-id={`remove-${song.id}`} aria-label={`${COPY.remove} ${song.title}`} onClick={() => { focusAfter.current = focusTargetAfter(canSing, song.id, "remove"); void run(() => removeSong(song.id), `Removed ${song.title}.`); }}>
                      {COPY.remove}
                    </Button>
                  </SongRow>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="learned-heading" className="max-w-2xl space-y-2">
            <h2 id="learned-heading" className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
              {COPY.learned}
            </h2>
            {learned.length === 0 ? (
              <p className="text-sm text-muted-foreground">{COPY.emptyLearned}</p>
            ) : (
              <ul aria-label={COPY.learned} className="m-0 list-none divide-y divide-border border-2 border-rule bg-card px-3">
                {learned.map((song) => (
                  <SongRow key={song.id} song={song}>
                    <Button variant="outline" size="sm" disabled={busy} data-focus-id={`move-${song.id}`} aria-label={`${COPY.moveToCanSing}: ${song.title}`} onClick={() => { focusAfter.current = focusTargetAfter(learned, song.id, "move"); void run(() => moveSong(song.id, "can_sing"), `${song.title} moved to ${COPY.canSing}.`); }}>
                      {COPY.moveToCanSing}
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy} data-focus-id={`remove-${song.id}`} aria-label={`${COPY.remove} ${song.title}`} onClick={() => { focusAfter.current = focusTargetAfter(learned, song.id, "remove"); void run(() => removeSong(song.id), `Removed ${song.title}.`); }}>
                      {COPY.remove}
                    </Button>
                  </SongRow>
                ))}
              </ul>
            )}
          </section>

          <LearnPanel songCount={songs.length} hasPlaylist={Boolean(playlist)} onSongsChanged={refreshPlaylist} />

          {playlist && (
            <section className="max-w-2xl">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={busy}>
                    {COPY.forget}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{COPY.forgetTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{COPY.forgetConfirm}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{COPY.forgetCancel}</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => void forget()}>
                      {COPY.forgetAction}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          )}
        </>
      )}

      <nav className="text-sm">
        <Link className="underline" href="/">
          Busk Map home
        </Link>
      </nav>
    </div>
  );
}
