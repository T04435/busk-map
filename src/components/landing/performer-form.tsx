"use client";

import { Icon } from "@/components/honeycomb/icon";
import { Loader } from "@/components/honeycomb/loader";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CityPicker } from "@/components/forms/city-picker";
import { PermitPicker } from "@/components/forms/permit-picker";
import { DatePicker } from "@/components/forms/date-picker";
import { choiceOf, slotIdOf, TimeSlotPicker } from "@/components/forms/time-slot-picker";
import { ArtistProfile } from "@/components/honeycomb/artist-profile";
import { profilePhoto } from "@/lib/spotify-profile";
import { actGenresOf } from "@/lib/repertoire-research";
import { SoundsLikeSuggestionsList, withSuggested } from "@/components/playlist/sounds-like-suggestions";
import { RepertoireSource } from "@/components/playlist/repertoire-source";
import { FormMessage } from "@/components/honeycomb/form-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldLabel, planFormError } from "@/lib/form-errors";
import { planRequestSchema, type PlanRequest, type PlanRequestInput } from "@/lib/plan-schema";
import { planSearchParams } from "@/lib/plan-url";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { type PlaylistView, type SpotifyProfile } from "@/lib/playlist-schema";
import { choiceForHours, hoursOf, type TimeChoice } from "@/lib/time-slots";
import { ArtistPicker, typedArtists, type PickedArtist } from "./artist-picker";

// "|" and "~" separate values in the plan URL.
const clean = (s: string) => s.replace(/[|~]/g, " ").trim();

/** How many suggested songs the busk asks for (plan-inputs-architecture.md D4): 6 when the busk has no songs of its own; none when the Repertoire has some. */
export const FILL_WHEN_EMPTY = 6;
export function fillCount(sent: number): number | undefined {
  return sent === 0 ? FILL_WHEN_EMPTY : undefined;
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

/** A song the busk carries: from the Repertoire (read-only here), or the last busk's when planning again. */
type PickedSong = { key: string; title: string; artist: string; durationMs: number | null; own: boolean };

/** A stored plan's act, to plan again ("Plan again for a new date"): everything but the date. */
export type FormPrefill = Pick<PlanRequest, "performer" | "permit"> & ({ startHour: number; endHour: number; anyTime?: false } | { anyTime: true });

const prefillArtists = (prefill: FormPrefill | undefined): PickedArtist[] =>
  (prefill?.performer.artists ?? []).map((name) => ({ name, spotifyId: prefill?.performer.spotifyArtists.find((a) => a.name === name)?.id ?? null, image: null }));

const prefillSongs = (prefill: FormPrefill | undefined): PickedSong[] =>
  (prefill?.performer.songs ?? []).map((song, i) => ({
    key: `again-${i}`,
    title: song.title,
    artist: song.artist,
    durationMs: song.durationMs ?? null,
    own: song.own,
  }));

/** The Repertoire as the form's fields (docs/playlist-architecture.md §3.1): name, sounds-like artists, songs. */
const repertoireFields = (view: PlaylistView) => ({
  name: view.actName ?? "",
  artists: view.soundsLike.map((a): PickedArtist => ({ name: a.name, spotifyId: a.spotifyId ?? null, qlooId: a.qlooId ?? null, image: a.image ?? null })),
  picked: view.songs.map(
    (song): PickedSong => ({ key: `rep-${song.id}`, title: song.title, artist: song.artist, durationMs: song.durationMs, own: song.own }),
  ),
});

/** The Repertoire's saved Spotify profile as ArtistProfile draws it (read-only here: no audience tags, no refresh). */
const profileOf = (profile: SpotifyProfile) => ({ name: profile.name, image: profilePhoto(profile.images), genres: profile.genres, audience: [], followers: profile.followers ?? null });

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
  songs: "[data-field=songs] a",
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
 * server from its cookie), or null. The Repertoire is READ-ONLY here (a summary and a link to /repertoire); the act name and
 * artists are plain fields for this busk, prefilled from it and never saved back.
 */
export function PerformerForm({ defaultDate, today, prefill, repertoire = null }: { defaultDate: string; today: string; prefill?: FormPrefill; repertoire?: PlaylistView | null }) {
  const router = useRouter();
  // The Repertoire is the starting point when there is one; ?again (a plan's act) still wins for the name, artists and songs.
  const rep = repertoire;
  const repAct = rep && !prefill ? repertoireFields(rep) : null;
  const [name, setName] = useState(repAct?.name ?? prefill?.performer.name ?? "");
  const [artists, setArtists] = useState<PickedArtist[]>(() => repAct?.artists ?? prefillArtists(prefill));
  const [artistQuery, setArtistQuery] = useState("");
  // The songs the busk carries: the Repertoire's (or, planning again, the last busk's).
  const songs = useMemo<PickedSong[]>(() => (prefill ? prefillSongs(prefill) : rep ? repertoireFields(rep).picked : []), [prefill, rep]);
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

  /** What the form holds now, as the request will carry it. */
  function currentFields() {
    const parsedSongs = songs.map((p) => ({ title: p.title, artist: p.artist, own: p.own, ...(p.durationMs ? { durationMs: p.durationMs } : {}) }));
    const chosen = [...artists];
    for (const typed of typedArtists(artistQuery)) {
      if (!chosen.some((a) => a.name.toLowerCase() === typed.toLowerCase())) chosen.push({ name: typed, spotifyId: null, image: null });
    }
    return { parsedSongs, chosen };
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
    // With no songs the busk plans with suggested songs only; with a Repertoire it asks for no fill.
    const fill = fillCount(parsedSongs.length);
    const input: PlanRequestInput = {
      city: "melbourne",
      slot: hours ? { date, ...hours } : { date, any: true },
      permit: permit as PlanRequestInput["permit"],
      performer: {
        name: clean(name) || "My act",
        artists: artistList,
        spotifyArtists,
        songs: parsedSongs,
        ...(fill ? { fillSuggested: fill } : {}),
        // Your own artist leads the taste signal, only when Qloo matched it (never a default: it would change the plan's hash).
        ...(rep?.qlooArtistId && rep.spotifyProfile?.name
          ? { ownArtist: { qlooId: rep.qlooArtistId, name: rep.spotifyProfile.name, ...(rep.spotifyArtistId ? { spotifyId: rep.spotifyArtistId } : {}) } }
          : {}),
        // Your genres from the research lead the local scene (never a default: it would change the plan's hash).
        ...(actGenresOf(rep?.research).length ? { genreTags: actGenresOf(rep?.research) } : {}),
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
        <SoundsLikeSuggestionsList
          enabled={Boolean(rep?.spotifyArtistId)}
          refreshKey={`${rep?.qlooArtistId ?? ""}|${rep?.spotifyProfile?.fetchedAt ?? ""}`}
          picked={currentFields().chosen.map((a) => a.name)}
          onAdd={(add) => setArtists((current) => withSuggested(current, add))}
        />
      </section>

      <div data-field="songs" className="flex flex-col gap-1.5">
        <RepertoireSource
          heading={prefill ? PLAYLIST_COPY.source.headingLastBusk : PLAYLIST_COPY.source.heading}
          songs={songs}
          hasRepertoire={Boolean(rep && rep.songs.length > 0)}
          header={
            rep?.spotifyArtistId && rep.spotifyProfile ? (
              <ArtistProfile size="md" maxGenres={5} profile={profileOf(rep.spotifyProfile)} />
            ) : null
          }
        />
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
