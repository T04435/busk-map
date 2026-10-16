"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { SongSearch } from "@/components/landing/song-search";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/live-search";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";
import { parseTypedSong, playlistSongKey, type PlaylistSongView, type PlaylistView } from "@/lib/playlist-schema";
import { LearnPanel } from "./learn-panel";
import { addSong, forgetPlaylist, loadPlaylist, moveSong, removeSong, type PlaylistResult } from "./playlist-api";

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
        <span className="block truncate font-medium">{song.title}</span>
        <span className="block truncate text-sm text-muted-foreground">{song.artist}</span>
      </span>
      {song.own && <Badge variant="secondary">{COPY.yourSong}</Badge>}
      {song.durationMs !== null && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.durationMs)}</span>}
      <span className="flex gap-2">{children}</span>
    </li>
  );
}

/** The Repertoire page: Songs you can sing and Learned, with add, remove and move. Plain shadcn; the look comes later. */
export function RepertoireView() {
  const [playlist, setPlaylist] = useState<PlaylistView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  // Where focus goes once a row is gone (B-016): the next row's action, the previous one's, or the add field.
  const focusAfter = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    loadPlaylist().then((result) => {
      if (!live) return;
      if (result.ok) setPlaylist(result.playlist);
      else setMessage({ kind: "error", text: result.message });
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

  async function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    const song = parseTypedSong(typed);
    if (!song) {
      setMessage({ kind: "error", text: COPY.errors.typedFormat });
      return;
    }
    if (await run(() => addSong({ ...song, source: "typed" }), `Added ${song.title}.`)) setTyped("");
  }

  async function forget() {
    if (!window.confirm(COPY.forgetConfirm)) return;
    await run(() => forgetPlaylist(), COPY.forgotten);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{COPY.pageTitle}</h1>
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

      <section aria-labelledby="add-heading" className="max-w-2xl space-y-4">
        <h2 id="add-heading" className="text-xl font-semibold">
          {COPY.searchLabel}
        </h2>
        <SongSearch
          artists={NO_ARTISTS}
          isAdded={(track) => keys.has(playlistSongKey(track.artists[0]?.name ?? "Unknown artist", track.title))}
          onAdd={(track) => void run(() => addSong(trackSong(track)), `Added ${track.title}.`)}
        />
        <form onSubmit={submitTyped} aria-label="Type in a song" className="space-y-2">
          <Label htmlFor="typed-song">{COPY.typedLabel}</Label>
          <div className="flex gap-2">
            <Input id="typed-song" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={COPY.typedPlaceholder} maxLength={210} autoComplete="off" />
            <Button type="submit" disabled={busy || !typed.trim()}>
              {COPY.typedAdd}
            </Button>
          </div>
        </form>
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
              <h2 id="can-sing-heading" className="text-xl font-semibold">
                {COPY.canSing}
              </h2>
              <span className="text-sm text-muted-foreground tabular-nums">{COPY.count(songs.length, max)}</span>
            </div>
            {canSing.length === 0 ? (
              <p className="text-sm text-muted-foreground">{COPY.empty}</p>
            ) : (
              <ul aria-label={COPY.canSing} className="divide-y">
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
            <h2 id="learned-heading" className="text-xl font-semibold">
              {COPY.learned}
            </h2>
            {learned.length === 0 ? (
              <p className="text-sm text-muted-foreground">{COPY.emptyLearned}</p>
            ) : (
              <ul aria-label={COPY.learned} className="divide-y">
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
              <Button variant="ghost" size="sm" disabled={busy} onClick={forget}>
                {COPY.forget}
              </Button>
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
