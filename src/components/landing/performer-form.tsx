"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadPlaylist, savePlaylist } from "@/components/playlist/playlist-api";
import { DatePicker } from "@/components/forms/date-picker";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { planFormError } from "@/lib/form-errors";
import { planRequestSchema, type PlanRequest, type PlanRequestInput } from "@/lib/plan-schema";
import { planSearchParams } from "@/lib/plan-url";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";
import type { PlaylistView } from "@/lib/playlist-schema";
import { draftOf, repertoireDraft, sameDraft } from "@/lib/repertoire-prefill";
import { weekSearchParams } from "@/lib/week-url";
import { formatHour } from "@/lib/slot";
import { formatDuration } from "@/lib/live-search";
import { ArtistPicker, typedArtists, type PickedArtist } from "./artist-picker";
import { SongCover, SongSearch } from "./song-search";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
// "|" and "~" separate values in the plan URL.
const clean = (s: string) => s.replace(/[|~]/g, " ").trim();

/** One song per line: "Title - Artist". Add "(own)" for your own songs. */
const PERMIT_LABELS = { general: "General", premium: "Premium", "circle-act": "Circle act" } as const;

export function parseSongLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const own = /\(own\)\s*$/i.test(line);
      const body = line.replace(/\(own\)\s*$/i, "").trim();
      const [title, ...rest] = body.split(/\s+[-–]\s+/);
      return { title: clean(title), artist: clean(rest.join(" - ")) || "Unknown artist", own };
    });
}

/** A song picked from Spotify (search or "Load my songs"), with what the search showed. */
type PickedSong = { key: string; title: string; artist: string; album: string | null; image: string | null; durationMs: number | null; own: boolean };

const toPicked = (track: TrackResult, own: boolean): PickedSong => ({
  key: track.id,
  title: clean(track.title),
  artist: clean(track.artists[0]?.name ?? "") || "Unknown artist",
  album: track.album,
  image: track.image,
  durationMs: track.durationMs,
  own,
});

/** A stored plan's act, to plan again ("Plan again for a new date"): everything but the date. */
export type FormPrefill = Pick<PlanRequest, "performer" | "permit"> & { startHour: number; endHour: number };

const prefillArtists = (prefill: FormPrefill | undefined): PickedArtist[] =>
  (prefill?.performer.artists ?? []).map((name) => ({ name, spotifyId: prefill?.performer.spotifyArtists.find((a) => a.name === name)?.id ?? null, image: null }));

const prefillSongs = (prefill: FormPrefill | undefined): PickedSong[] =>
  (prefill?.performer.songs ?? []).map((song, i) => ({
    key: `again-${i}`,
    title: song.title,
    artist: song.artist,
    album: null,
    image: null,
    durationMs: song.durationMs ?? null,
    own: song.own,
  }));

/** The Repertoire as the form's fields (docs/playlist-architecture.md §3.1): name, sounds-like artists, songs. */
const repertoireFields = (view: PlaylistView) => ({
  name: view.actName ?? "",
  artists: view.soundsLike.map((a): PickedArtist => ({ name: a.name, spotifyId: a.spotifyId ?? null, image: null })),
  picked: view.songs.map(
    (song): PickedSong => ({ key: `rep-${song.id}`, title: song.title, artist: song.artist, album: null, image: null, durationMs: song.durationMs, own: song.own }),
  ),
});

/**
 * `today` is the city's local date: a plan is for today or later. `repertoire` is this device's Repertoire (read on the
 * server from its cookie), or null: with none, the form is exactly what it always was.
 */
export function PerformerForm({ defaultDate, today, prefill, repertoire = null }: { defaultDate: string; today: string; prefill?: FormPrefill; repertoire?: PlaylistView | null }) {
  const router = useRouter();
  // "Use my Repertoire" is on by default when there is one with songs; ?again (a plan's act) still wins.
  const [saved, setSaved] = useState<PlaylistView | null>(repertoire && repertoire.songs.length > 0 ? repertoire : null);
  const [useMine, setUseMine] = useState(Boolean(saved) && !prefill);
  const initial = useMine && saved ? repertoireFields(saved) : null;
  const [name, setName] = useState(initial?.name ?? prefill?.performer.name ?? "");
  const [artists, setArtists] = useState<PickedArtist[]>(() => initial?.artists ?? prefillArtists(prefill));
  const [artistQuery, setArtistQuery] = useState("");
  const [picked, setPicked] = useState<PickedSong[]>(() => initial?.picked ?? prefillSongs(prefill));
  const [repNote, setRepNote] = useState<{ kind: "info" | "error" | "stale"; text: string } | null>(null);
  const [repBusy, setRepBusy] = useState(false);
  const [songs, setSongs] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [from, setFrom] = useState(String(prefill?.startHour ?? 18));
  const [to, setTo] = useState(String(prefill?.endHour ?? 21));
  const [permit, setPermit] = useState<string>(prefill?.permit ?? "general");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [spotifyLink, setSpotifyLink] = useState("");

  /** Fill the act, artists and songs from a source (the Repertoire, the ?again act, or nothing). */
  function fill(fields: { name: string; artists: PickedArtist[]; picked: PickedSong[] }) {
    setName(fields.name);
    setArtists(fields.artists);
    setArtistQuery("");
    setPicked(fields.picked);
    setSongs("");
  }

  function toggleRepertoire(on: boolean) {
    setUseMine(on);
    setRepNote(null);
    if (on && saved) fill(repertoireFields(saved));
    else fill({ name: prefill?.performer.name ?? "", artists: prefillArtists(prefill), picked: prefillSongs(prefill) });
  }

  /** What the form holds now, as the request will carry it. */
  function currentFields() {
    const parsedSongs = [
      ...picked.map((p) => ({ title: p.title, artist: p.artist, own: p.own, ...(p.durationMs ? { durationMs: p.durationMs } : {}) })),
      ...parseSongLines(songs),
    ];
    const chosen = [...artists];
    for (const typed of typedArtists(artistQuery)) {
      if (!chosen.some((a) => a.name.toLowerCase() === typed.toLowerCase())) chosen.push({ name: typed, spotifyId: null, image: null });
    }
    return { parsedSongs, chosen };
  }

  const edited = useMine && saved !== null && !sameDraft(draftOf({ name: clean(name), artists: currentFields().chosen.map((a) => a.name), songs: currentFields().parsedSongs }), repertoireDraft(saved));

  /** The only thing here that writes the Repertoire: an explicit save, checked against the revision last seen. */
  async function saveToRepertoire() {
    if (!saved) return;
    const { parsedSongs, chosen } = currentFields();
    setRepBusy(true);
    setRepNote(null);
    const result = await savePlaylist({
      revision: saved.revision,
      actName: clean(name) || null,
      soundsLike: chosen.slice(0, 10).map((a) => ({ name: a.name, ...(a.spotifyId ? { spotifyId: a.spotifyId } : {}) })),
      songs: parsedSongs.slice(0, 60),
    });
    setRepBusy(false);
    if (result.ok && result.playlist) {
      setSaved(result.playlist);
      fill(repertoireFields(result.playlist));
      setRepNote({ kind: "info", text: COPY.saved });
    } else if (!result.ok) setRepNote({ kind: result.code === "stale" ? "stale" : "error", text: result.message });
  }

  /** The Repertoire changed elsewhere (another tab): fetch the latest and fill from it. */
  async function reloadRepertoire() {
    const result = await loadPlaylist();
    if (result.ok && result.playlist) {
      setSaved(result.playlist);
      fill(repertoireFields(result.playlist));
      setRepNote(null);
    }
  }

  function addSongs(next: PickedSong[]) {
    setPicked((current) => [...current, ...next.filter((song) => !current.some((c) => c.key === song.key))].slice(0, 60));
  }

  async function loadOwnSongs() {
    setSearchNote("Loading your songs from Spotify…");
    const res = await fetch(`/api/repertoire?${new URLSearchParams({ type: "artist", link: spotifyLink })}`).catch(() => null);
    const body = res?.ok ? await res.json() : null;
    const tracks: TrackResult[] = body?.tracks ?? [];
    if (!tracks.length) {
      setSearchNote(
        res?.status === 429
          ? "Too many searches in a short time. Wait a moment and try again."
          : body?.reason === "not_found"
            ? "Spotify has no artist at that link. Open it in Spotify to check it, then copy the artist's share link again."
            : body?.mode === "fallback"
              ? "Spotify isn't answering right now. Try again in a minute, or type your songs below."
              : "Couldn't load songs from that link. Paste an open.spotify.com/artist/… link, or type your songs.",
      );
      return;
    }
    addSongs(tracks.slice(0, 20).map((t) => toPicked(t, true)));
    setSearchNote(
      body?.mode === "synthetic"
        ? "Offline test mode: these songs are made up, not from Spotify."
        : `Added ${Math.min(tracks.length, 20)} of your songs from Spotify. Remove any you don't play.`,
    );
  }

  /** The plan's short link (/p/<id>), or the long URL if no link could be made. */
  async function openPlan(request: PlanRequest) {
    setSubmitting(true);
    const res = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    router.push(typeof body?.path === "string" ? body.path : `/plan?${planSearchParams(request, { run: "1" })}`);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "week" ? "week" : "plan";
    const { parsedSongs, chosen } = currentFields();
    const artistList = [
      ...new Set([...chosen.map((a) => a.name), ...parsedSongs.filter((s) => !s.own).map((s) => s.artist)]),
    ].slice(0, 10);
    const spotifyArtists = chosen.flatMap((a) => (a.spotifyId && artistList.includes(a.name) ? [{ name: a.name, id: a.spotifyId }] : []));
    if (date < today) {
      setError("Pick today or a later date.");
      return;
    }
    const input: PlanRequestInput = {
      city: "melbourne",
      slot: { date, startHour: Number(from), endHour: Number(to) },
      permit: permit as PlanRequestInput["permit"],
      performer: { name: clean(name) || "My act", artists: artistList, spotifyArtists, songs: parsedSongs },
    };
    const result = planRequestSchema.safeParse(input);
    if (!result.success) {
      setError(planFormError(result.error.issues, input));
      return;
    }
    setError(null);
    if (target === "week") {
      const { slot, ...rest } = result.data;
      router.push(`/week?${weekSearchParams({ ...rest, startDate: slot.date, limits: { maxSessions: 5, maxPerDay: 1, unavailable: [] } }, null)}`);
      return;
    }
    void openPlan(result.data);
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Plan for your own act">
      {saved && (
        <section aria-label={COPY.name} className="space-y-2 rounded-lg border p-3" data-testid="use-repertoire">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Switch id="use-repertoire" checked={useMine} onCheckedChange={toggleRepertoire} />
            <Label htmlFor="use-repertoire">{COPY.mineWithCount(saved.songs.length)}</Label>
            {useMine && <Badge variant={edited ? "secondary" : "outline"}>{edited ? COPY.editedForBusk : COPY.fromRepertoire}</Badge>}
          </div>
          {useMine && edited && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">{COPY.editedHint}</p>
              <Button type="button" variant="outline" size="sm" disabled={repBusy} onClick={() => void saveToRepertoire()}>
                {repBusy ? COPY.saving : COPY.saveChanges}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={repBusy} onClick={() => toggleRepertoire(true)}>
                Back to my {COPY.name}
              </Button>
            </div>
          )}
          {repNote && (
            <p role={repNote.kind === "info" ? "status" : "alert"} className={repNote.kind === "info" ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
              {repNote.text}
              {repNote.kind === "stale" && (
                <>
                  {" "}
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void reloadRepertoire()}>
                    {COPY.reload}
                  </Button>
                </>
              )}
            </p>
          )}
        </section>
      )}
      <div className="space-y-1">
        <Label htmlFor="name">Act name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jess on acoustic guitar" maxLength={80} />
      </div>
      <ArtistPicker value={artists} onChange={setArtists} query={artistQuery} onQueryChange={setArtistQuery} />

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium">Songs you can play</legend>
        <SongSearch
          onAdd={(track) => addSongs([toPicked(track, false)])}
          isAdded={(track) => picked.some((p) => p.key === track.id)}
          artists={artists}
        />
        {picked.length > 0 && (
          <ul aria-label="Songs you picked" className="divide-y rounded-lg border text-sm">
            {picked.map((song) => (
              <li key={song.key} className="flex items-center gap-2 px-2 py-1.5">
                <SongCover image={song.image} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{song.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[song.artist, song.album].filter(Boolean).join(" · ")}</span>
                </span>
                {song.own && <Badge variant="secondary">Your song</Badge>}
                {song.durationMs !== null && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.durationMs)}</span>}
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${song.title}`} onClick={() => setPicked((current) => current.filter((p) => p !== song))}>
                  <XIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Your Spotify artist link" value={spotifyLink} onChange={(e) => setSpotifyLink(e.target.value)} placeholder="Your Spotify artist link (optional)" />
          <Button type="button" variant="outline" className="self-start sm:self-auto" onClick={() => void loadOwnSongs()} disabled={spotifyLink.trim().length < 10}>
            Load my songs
          </Button>
        </div>
        {searchNote && <p className="text-sm text-muted-foreground" aria-live="polite">{searchNote}</p>}
        <Label htmlFor="songs" className="text-sm font-normal text-muted-foreground">
          Song list: type songs Spotify doesn&apos;t have
        </Label>
        <Textarea
          id="songs"
          value={songs}
          onChange={(e) => setSongs(e.target.value)}
          rows={4}
          placeholder={"One per line: Title - Artist\nHow to Make Gravy - Paul Kelly\nMy Song - Me (own)"}
        />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="date">Date</Label>
          <DatePicker id="date" value={date} onChange={setDate} min={today} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger id="from" className="w-full">
              <SelectValue>{formatHour(Number(from))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {formatHour(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger id="to" className="w-full">
              <SelectValue>{formatHour(Number(to))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h + 1} value={String(h + 1)}>
                  {formatHour(h + 1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="permit">Permit</Label>
          <Select value={permit} onValueChange={setPermit}>
            <SelectTrigger id="permit" className="w-full">
              {/* The label as children, so the server HTML shows it before hydration (B-006). */}
              <SelectValue>{PERMIT_LABELS[permit as keyof typeof PERMIT_LABELS]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERMIT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" value="plan" disabled={submitting}>
          Plan my set
        </Button>
        <Button type="submit" value="week" variant="outline">
          Plan my week from this date
        </Button>
      </div>
    </form>
  );
}
