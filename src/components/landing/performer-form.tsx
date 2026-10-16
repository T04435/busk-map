"use client";

import { Icon } from "@/components/honeycomb/icon";
import { Loader } from "@/components/honeycomb/loader";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadPlaylist, savePlaylist } from "@/components/playlist/playlist-api";
import { CityPicker } from "@/components/forms/city-picker";
import { PermitPicker } from "@/components/forms/permit-picker";
import { DatePicker } from "@/components/forms/date-picker";
import { choiceOf, slotIdOf, TimeSlotPicker } from "@/components/forms/time-slot-picker";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { RepertoireAdd } from "@/components/playlist/repertoire-add";
import { RepertoireSource } from "@/components/playlist/repertoire-source";
import { FormMessage } from "@/components/honeycomb/form-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldLabel, planFormError } from "@/lib/form-errors";
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

/** The form fields an error can belong to (B-003: every error names its field). */
type Field = "name" | "artists" | "songs" | "slot" | "permit";
type FormError = { field: Field; /** The field's name as the form labels it. */ label: string; /** The whole sentence, naming the field. */ message: string; /** The sentence without the field's name in front, for the alert body. */ detail: string };

function fieldOf(path: string): Field {
  if (path.startsWith("performer.name")) return "name";
  if (path.startsWith("performer.songs") || path.startsWith("performer.fillSuggested") || path.startsWith("performer.skipSongs")) return "songs";
  if (path.startsWith("slot")) return "slot";
  if (path === "permit") return "permit";
  return "artists";
}

/** What takes focus for each field when its error shows. */
const FOCUS_TARGET: Record<Field, string> = {
  name: "#name",
  artists: "[data-field=artists] input",
  songs: "[data-field=songs] input, [data-field=songs] button",
  slot: "#date",
  permit: "[data-field=permit] [role=radio][tabindex='0']",
};

const FIELD_LABEL: Record<Field, string> = { name: "Act name", artists: "Artists you sound like", songs: "Songs you can play", slot: "Date and times", permit: "Permit" };

function errorFor(issues: { path: PropertyKey[]; message: string }[], input: PlanRequestInput): FormError {
  const path = (issues[0]?.path ?? []).map(String).join(".");
  const field = fieldOf(path);
  const label = fieldLabel(path) ?? FIELD_LABEL[field];
  const message = planFormError(issues, input);
  return { field, label, message, detail: message.startsWith(`${label}: `) ? message.slice(label.length + 2) : message };
}

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
  // Hours from an old link that match no named slot stay on offer as a "From your link" choice, so nothing is lost.
  const [customHours] = useState(() => {
    const choice = initialTime(prefill);
    return choice.kind === "custom" ? { startHour: choice.startHour, endHour: choice.endHour } : null;
  });
  const [permit, setPermit] = useState<string>(prefill?.permit ?? "general");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** Bumped on each failed submit, so the focus moves again even when the same field fails twice (B-220). */
  const [failures, setFailures] = useState(0);

  // B-220: a failed submit moves focus to the first invalid field and wires that field to its error message.
  useEffect(() => {
    if (!error || !failures) return;
    const root = formRef.current;
    const target = root?.querySelector<HTMLElement>(FOCUS_TARGET[error.field]);
    if (!target) return;
    target.setAttribute("aria-invalid", "true");
    target.setAttribute("aria-describedby", `err-${error.field}`);
    target.focus();
    return () => {
      // Only the pickers we do not own get their attributes set by hand; the owned fields render theirs.
      if (error.field === "artists" || error.field === "songs") {
        target.removeAttribute("aria-invalid");
        target.removeAttribute("aria-describedby");
      }
    };
  }, [error, failures]);

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

  function fillFrom(view: PlaylistView) {
    const fields = repertoireFields(view);
    setName(fields.name);
    setArtists(fields.artists);
    setArtistQuery("");
    setBase(fields.picked);
    setRemoved(new Set());
    setAdded([]);
  }

  function reset() {
    if (saved) fillFrom(saved);
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
      fillFrom(result.playlist);
      setRepNote({ kind: "info", text: COPY.saved });
    } else if (!result.ok) setRepNote({ kind: result.code === "stale" ? "stale" : "error", text: result.message });
  }

  /** The Repertoire changed elsewhere (another tab): fetch the latest and fill from it. */
  async function reloadRepertoire() {
    const result = await loadPlaylist();
    if (result.ok && result.playlist) {
      setSaved(result.playlist);
      fillFrom(result.playlist);
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

  // The pending state belongs to one click. Coming back to this page (Back, the bfcache, or the router keeping this
  // page mounted while hidden, which re-runs effects when it shows again) starts it fresh, never stuck on "Planning…".
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSubmitting(false));
    const onPageShow = () => setSubmitting(false);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  /** The plan's short link (/p/<id>), or the long URL if no link could be made. */
  async function openPlan(request: PlanRequest) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => null) : null;
      router.push(typeof body?.path === "string" ? body.path : `/plan?${planSearchParams(request, { run: "1" })}`);
    } catch {
      setSubmitting(false);
      return;
    }
    // If the navigation never happens (for example it was blocked), the button comes back instead of spinning forever.
    window.setTimeout(() => setSubmitting(false), 10_000);
  }

  /** Enter in a text field does that field's own job (search, load a link), never plans the busk: only the button does. */
  function keepEnterInFields(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && !["submit", "button", "checkbox", "radio"].includes(target.type)) event.preventDefault();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return; // B-221: no double submit
    const { parsedSongs, chosen } = currentFields();
    const artistList = [
      ...new Set([...chosen.map((a) => a.name), ...parsedSongs.filter((s) => !s.own).map((s) => s.artist)]),
    ].slice(0, 10);
    const spotifyArtists = chosen.flatMap((a) => (a.spotifyId && artistList.includes(a.name) ? [{ name: a.name, id: a.spotifyId }] : []));
    if (date < today) {
      const message = "Date: Pick today or a later date.";
      setError({ field: "slot", label: FIELD_LABEL.slot, message, detail: "Pick today or a later date." });
      setFailures((n) => n + 1);
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
      setError(errorFor(result.error.issues, input));
      setFailures((n) => n + 1);
      return;
    }
    setError(null);
    void openPlan(result.data);
  }

  const errorId = (field: Field) => (error?.field === field ? `err-${field}` : undefined);
  const hasError = (field: Field) => error?.field === field;

  const noteView = repNote && (
    <FormMessage tone={repNote.kind === "info" ? "success" : "error"}>
      {repNote.text}
      {repNote.kind === "stale" && (
        <>
          {" "}
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void reloadRepertoire()}>
            {COPY.reload}
          </Button>
        </>
      )}
    </FormMessage>
  );

  return (
    <form ref={formRef} onSubmit={submit} onKeyDown={keepEnterInFields} className="flex flex-col gap-7 border-2 border-rule bg-card p-4 md:p-7" aria-label="Plan for your own act" aria-busy={submitting || undefined} noValidate>
      <section aria-label="Your act" className="flex flex-col gap-4.5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Act name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jess on acoustic guitar" maxLength={80} aria-invalid={hasError("name") || undefined} aria-describedby={errorId("name")} />
          {hasError("name") && (
            <FormMessage tone="error" id="err-name" alert={false}>
              {error!.message}
            </FormMessage>
          )}
        </div>
        <div className="space-y-1.5" data-field="artists">
          <ArtistPicker value={artists} onChange={setArtists} query={artistQuery} onQueryChange={setArtistQuery} />
          {hasError("artists") && (
            <FormMessage tone="error" id="err-artists" alert={false}>
              {error!.message}
            </FormMessage>
          )}
        </div>
      </section>

      <div data-field="songs" className="flex flex-col gap-1.5">
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
        {hasError("songs") && (
          <FormMessage tone="error" id="err-songs" alert={false}>
            {error!.message}
          </FormMessage>
        )}
      </div>

      <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <legend className="mb-1 p-0 font-display text-[26px] leading-none font-extrabold uppercase">When and where</legend>
        <CityPicker cities={[{ id: "melbourne", name: "Melbourne", level: "live", note: "Taste, foot traffic, busking rules, events and weather" }]} value="melbourne" onValueChange={() => {}} />
        <div className="flex max-w-80 flex-col gap-1.5" data-field="slot">
          <DatePicker id="date" label="Date" value={date} onChange={setDate} min={today} invalid={hasError("slot")} aria-describedby={errorId("slot")} />
          {hasError("slot") && (
            <FormMessage tone="error" id="err-slot" alert={false}>
              {error!.message}
            </FormMessage>
          )}
        </div>
        <TimeSlotPicker
          anyTime
          value={slotIdOf(time)}
          custom={customHours}
          onChange={(id) => {
            const next = choiceOf(id, customHours);
            if (next) setTime(next);
          }}
        />
        <div className="flex flex-col gap-1.5" data-field="permit">
          <PermitPicker value={permit} onValueChange={setPermit} />
          {hasError("permit") && (
            <FormMessage tone="error" id="err-permit" alert={false}>
              {error!.message}
            </FormMessage>
          )}
        </div>
      </fieldset>

      {error && (
        <Alert variant="error">
          <AlertTitle>{error.label}</AlertTitle>
          <AlertDescription>{error.detail}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-3 border-t-2 border-rule pt-5 max-sm:[&>button]:w-full">
        <Button type="submit" value="plan" size="lg" disabled={submitting} aria-disabled={submitting || undefined}>
          {submitting ? "Planning…" : "Plan my busk"}
          {submitting ? <span aria-hidden="true"><Loader size={16} /></span> : <Icon name="arrow-right" size={18} />}
        </Button>
      </div>
    </form>
  );
}
