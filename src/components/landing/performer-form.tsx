"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadPlaylist, savePlaylist } from "@/components/playlist/playlist-api";
import { DatePicker } from "@/components/forms/date-picker";
import { TimeSlotPicker } from "@/components/forms/time-slot-picker";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { RepertoireAdd } from "@/components/playlist/repertoire-add";
import { RepertoireSource } from "@/components/playlist/repertoire-source";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { planFormError } from "@/lib/form-errors";
import { planRequestSchema, type PlanRequest, type PlanRequestInput } from "@/lib/plan-schema";
import { planSearchParams } from "@/lib/plan-url";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";
import { playlistSongKey, type PlaylistView } from "@/lib/playlist-schema";
import { draftOf, repertoireDraft, sameDraft } from "@/lib/repertoire-prefill";
import { choiceForHours, hoursOf, type TimeChoice } from "@/lib/time-slots";
import { ArtistPicker, typedArtists, type PickedArtist } from "./artist-picker";

// "|" and "~" separate values in the plan URL.
const clean = (s: string) => s.replace(/[|~]/g, " ").trim();

/** How many suggested songs the busk asks for (plan-inputs-architecture.md D4): what was removed, at least 3 and at most 8; 6 after Remove all or with no songs. */
export const FILL_MIN = 3;
export const FILL_MAX = 8;
export const FILL_WHEN_EMPTY = 6;
export function fillCount(removed: number, sent: number): number | undefined {
  if (sent === 0) return FILL_WHEN_EMPTY;
  return removed > 0 ? Math.min(FILL_MAX, Math.max(FILL_MIN, removed)) : undefined;
}

const PERMIT_LABELS = { general: "General", premium: "Premium", "circle-act": "Circle act" } as const;

/** One song per line: "Title - Artist". Add "(own)" for your own songs. (The planner no longer has the box; the plan-link parser tests use it.) */
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

/** A song in the form, with what the search showed. */
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

const typedSong = (title: string, artist: string): PickedSong => ({ key: `typed-${playlistSongKey(artist, title)}`, title: clean(title), artist: clean(artist) || "Unknown artist", album: null, image: null, durationMs: null, own: false });

/** A stored plan's act, to plan again ("Plan again for a new date"): everything but the date. */
export type FormPrefill = Pick<PlanRequest, "performer" | "permit"> & ({ startHour: number; endHour: number; anyTime?: false } | { anyTime: true });

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

/** The time choice a prefill starts on: any time by default (also when planning again), or the hours of an old plan as the matching named slot or a custom one. */
const initialTime = (prefill: FormPrefill | undefined): TimeChoice => (prefill && !prefill.anyTime ? choiceForHours(prefill.startHour, prefill.endHour) : { kind: "any" });

/**
 * `today` is the city's local date: a plan is for today or later. `repertoire` is this device's Repertoire (read on the
 * server from its cookie), or null: with none, the block says so and the busk plans with suggested songs.
 */
export function PerformerForm({ defaultDate, today, prefill, repertoire = null }: { defaultDate: string; today: string; prefill?: FormPrefill; repertoire?: PlaylistView | null }) {
  const router = useRouter();
  // The Repertoire is the starting point when there is one with songs; ?again (a plan's act) still wins.
  const [saved, setSaved] = useState<PlaylistView | null>(repertoire && repertoire.songs.length > 0 && !prefill ? repertoire : null);
  const initial = saved ? repertoireFields(saved) : null;
  const [name, setName] = useState(initial?.name ?? prefill?.performer.name ?? "");
  const [artists, setArtists] = useState<PickedArtist[]>(() => initial?.artists ?? prefillArtists(prefill));
  const [artistQuery, setArtistQuery] = useState("");
  // The block: the Repertoire's songs (or the last busk's), the ones unticked for this busk, and the ones added just for it.
  const [base, setBase] = useState<PickedSong[]>(() => initial?.picked ?? prefillSongs(prefill));
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<PickedSong[]>([]);
  const [editing, setEditing] = useState(false);
  const [repNote, setRepNote] = useState<{ kind: "info" | "error" | "stale"; text: string } | null>(null);
  const [repBusy, setRepBusy] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState<TimeChoice>(() => initialTime(prefill));
  // Hours from an old link that match no named slot stay on offer as a "From–To" choice, so nothing is lost.
  const [customHours] = useState(() => {
    const choice = initialTime(prefill);
    return choice.kind === "custom" ? { startHour: choice.startHour, endHour: choice.endHour } : null;
  });
  const [permit, setPermit] = useState<string>(prefill?.permit ?? "general");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kept = base.filter((s) => !removed.has(s.key));
  const sentSongs = [...kept, ...added];

  /** What the form holds now, as the request will carry it. */
  function currentFields() {
    const parsedSongs = sentSongs.map((p) => ({ title: p.title, artist: p.artist, own: p.own, ...(p.durationMs ? { durationMs: p.durationMs } : {}) }));
    const chosen = [...artists];
    for (const typed of typedArtists(artistQuery)) {
      if (!chosen.some((a) => a.name.toLowerCase() === typed.toLowerCase())) chosen.push({ name: typed, spotifyId: null, image: null });
    }
    return { parsedSongs, chosen };
  }

  const edited = saved !== null && !sameDraft(draftOf({ name: clean(name), artists: currentFields().chosen.map((a) => a.name), songs: currentFields().parsedSongs }), repertoireDraft(saved));

  function reset() {
    if (!saved) return;
    const fields = repertoireFields(saved);
    setName(fields.name);
    setArtists(fields.artists);
    setArtistQuery("");
    setBase(fields.picked);
    setRemoved(new Set());
    setAdded([]);
  }

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
      const fields = repertoireFields(result.playlist);
      setName(fields.name);
      setArtists(fields.artists);
      setArtistQuery("");
      setBase(fields.picked);
      setRemoved(new Set());
      setAdded([]);
      setRepNote({ kind: "info", text: COPY.saved });
    } else if (!result.ok) setRepNote({ kind: result.code === "stale" ? "stale" : "error", text: result.message });
  }

  /** The Repertoire changed elsewhere (another tab): fetch the latest and fill from it. */
  async function reloadRepertoire() {
    const result = await loadPlaylist();
    if (result.ok && result.playlist) {
      setSaved(result.playlist);
      const fields = repertoireFields(result.playlist);
      setName(fields.name);
      setArtists(fields.artists);
      setBase(fields.picked);
      setRemoved(new Set());
      setAdded([]);
      setRepNote(null);
    }
  }

  const inForm = (key: string) => base.some((s) => s.key === key) || added.some((s) => s.key === key);
  const sameSong = (a: { title: string; artist: string }, b: { title: string; artist: string }) => playlistSongKey(a.artist, a.title) === playlistSongKey(b.artist, b.title);

  /** Add songs just for this busk; a song already in the block is ticked again instead of doubled. */
  function addSongs(next: PickedSong[]) {
    const unticked = base.filter((s) => removed.has(s.key) && next.some((n) => sameSong(n, s)));
    if (unticked.length > 0) {
      const back = new Set(removed);
      for (const s of unticked) back.delete(s.key);
      setRemoved(back);
    }
    setAdded((current) =>
      [...current, ...next.filter((n) => !inForm(n.key) && !base.some((s) => sameSong(n, s)) && !current.some((c) => sameSong(n, c)))].slice(0, 60 - base.length),
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
    const { parsedSongs, chosen } = currentFields();
    const artistList = [
      ...new Set([...chosen.map((a) => a.name), ...parsedSongs.filter((s) => !s.own).map((s) => s.artist)]),
    ].slice(0, 10);
    const spotifyArtists = chosen.flatMap((a) => (a.spotifyId && artistList.includes(a.name) ? [{ name: a.name, id: a.spotifyId }] : []));
    if (date < today) {
      setError("Date: Pick today or a later date.");
      return;
    }
    const hours = hoursOf(time);
    // Songs removed for this busk are filled by suggested ones (not the removed songs themselves); none at all plans with suggestions only.
    const removedSongs = base.filter((s) => removed.has(s.key)).map((s) => ({ title: s.title, artist: s.artist }));
    const fill = fillCount(removedSongs.length, parsedSongs.length);
    const input: PlanRequestInput = {
      city: "melbourne",
      slot: hours ? { date, ...hours } : { date, any: true },
      permit: permit as PlanRequestInput["permit"],
      performer: {
        name: clean(name) || "My act",
        artists: artistList,
        spotifyArtists,
        songs: parsedSongs,
        ...(fill ? { fillSuggested: fill, ...(removedSongs.length ? { skipSongs: removedSongs.slice(0, 60) } : {}) } : {}),
      },
    };
    const result = planRequestSchema.safeParse(input);
    if (!result.success) {
      setError(planFormError(result.error.issues, input));
      return;
    }
    setError(null);
    void openPlan(result.data);
  }

  const noteView = repNote && (
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
  );

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Plan for your own act">
      <div className="space-y-1">
        <Label htmlFor="name">Act name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jess on acoustic guitar" maxLength={80} />
      </div>
      <ArtistPicker value={artists} onChange={setArtists} query={artistQuery} onQueryChange={setArtistQuery} />

      <RepertoireSource
        heading={prefill && !saved ? COPY.source.headingLastBusk : COPY.source.heading}
        base={base}
        removed={removed}
        added={added}
        editing={editing}
        onEditingChange={setEditing}
        onRemovedChange={setRemoved}
        onAddedChange={setAdded}
        addSlot={
          <RepertoireAdd
            artists={artists}
            isAdded={(track) => inForm(track.id) || sentSongs.some((s) => sameSong(s, { title: clean(track.title), artist: clean(track.artists[0]?.name ?? "") || "Unknown artist" }))}
            onAddTrack={(track) => addSongs([toPicked(track, false)])}
            onAddTyped={(song) => addSongs([typedSong(song.title, song.artist)])}
            onAddOwn={(tracks) => addSongs(tracks.map((t) => toPicked(t, true)))}
          />
        }
        save={saved ? { edited, busy: repBusy, onSave: () => void saveToRepertoire(), onReset: reset, note: noteView } : null}
      />
      {!saved && noteView}

      <fieldset className="min-w-0 space-y-4">
        <legend className="text-sm font-medium">When and where</legend>
        <div className="max-w-xs space-y-1">
          <Label htmlFor="date">Date</Label>
          <DatePicker id="date" value={date} onChange={setDate} min={today} />
        </div>
        <TimeSlotPicker value={time} onChange={setTime} custom={customHours} />
        <div className="max-w-xs space-y-1">
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
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" value="plan" disabled={submitting}>
          Plan my set
        </Button>
      </div>
    </form>
  );
}
