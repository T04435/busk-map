"use client";

import { Icon } from "@/components/honeycomb/icon";
import { Loader } from "@/components/honeycomb/loader";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CityPicker } from "@/components/forms/city-picker";
import { PermitPicker } from "@/components/forms/permit-picker";
import { DatePicker } from "@/components/forms/date-picker";
import { QUICK_SLOTS, TimeSlotPicker } from "@/components/forms/time-slot-picker";
import { FormMessage } from "@/components/honeycomb/form-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldLabel, planFormError } from "@/lib/form-errors";
import { planRequestSchema, type PlanRequest, type PlanRequestInput } from "@/lib/plan-schema";
import { planSearchParams } from "@/lib/plan-url";
import { ArtistPicker, typedArtists, type PickedArtist } from "./artist-picker";
import { RepertoirePicker, type PickedSong } from "./repertoire-picker";

// "|" and "~" separate values in the plan URL.
const clean = (s: string) => s.replace(/[|~]/g, " ").trim();

/** One song per line: "Title - Artist". Add "(own)" for your own songs. */
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

/** The form fields an error can belong to (B-003: every error names its field). */
type Field = "name" | "artists" | "songs" | "slot" | "permit";
type FormError = { field: Field; /** The field's name as the form labels it. */ label: string; /** The whole sentence, naming the field. */ message: string; /** The sentence without the field's name in front, for the alert body. */ detail: string };

function fieldOf(path: string): Field {
  if (path.startsWith("performer.name")) return "name";
  if (path.startsWith("performer.songs")) return "songs";
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

/** `today` is the city's local date: a plan is for today or later. */
export function PerformerForm({ defaultDate, today, prefill }: { defaultDate: string; today: string; prefill?: FormPrefill }) {
  const router = useRouter();
  const [name, setName] = useState(prefill?.performer.name ?? "");
  const [artists, setArtists] = useState<PickedArtist[]>(() => prefillArtists(prefill));
  const [artistQuery, setArtistQuery] = useState("");
  const [picked, setPicked] = useState<PickedSong[]>(() => prefillSongs(prefill));
  const [slot, setSlot] = useState({ date: defaultDate, from: String(prefill?.startHour ?? 18), to: String(prefill?.endHour ?? 21) });
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

  /** The plan's short link (/p/<id>), or the long URL if no link could be made. */
  async function openPlan(request: PlanRequest) {
    setSubmitting(true);
    const res = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    router.push(typeof body?.path === "string" ? body.path : `/plan?${planSearchParams(request, { run: "1" })}`);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return; // B-221: no double submit
    const parsedSongs = [
      ...picked.map((p) => ({ title: p.title, artist: p.artist, own: p.own, ...(p.durationMs ? { durationMs: p.durationMs } : {}) })),
    ];
    const chosen = [...artists];
    for (const typed of typedArtists(artistQuery)) {
      if (!chosen.some((a) => a.name.toLowerCase() === typed.toLowerCase())) chosen.push({ name: typed, spotifyId: null, image: null });
    }
    const artistList = [
      ...new Set([...chosen.map((a) => a.name), ...parsedSongs.filter((s) => !s.own).map((s) => s.artist)]),
    ].slice(0, 10);
    const spotifyArtists = chosen.flatMap((a) => (a.spotifyId && artistList.includes(a.name) ? [{ name: a.name, id: a.spotifyId }] : []));
    if (slot.date < today) {
      const message = "Pick today or a later date.";
      setError({ field: "slot", label: FIELD_LABEL.slot, message, detail: message });
      setFailures((n) => n + 1);
      return;
    }
    const input: PlanRequestInput = {
      city: "melbourne",
      slot: { date: slot.date, startHour: Number(slot.from), endHour: Number(slot.to) },
      permit: permit as PlanRequestInput["permit"],
      performer: { name: clean(name) || "My act", artists: artistList, spotifyArtists, songs: parsedSongs },
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

  const pickedSlot = QUICK_SLOTS.find((q) => String(q.from) === slot.from && String(q.to) === slot.to)?.id ?? "";
  const errorId = (field: Field) => (error?.field === field ? `err-${field}` : undefined);
  const hasError = (field: Field) => error?.field === field;

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-7 border-2 border-rule bg-card p-4 md:p-7" aria-label="Plan for your own act" aria-busy={submitting || undefined} noValidate>
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

      <div data-field="songs">
        <RepertoirePicker artists={artists} picked={picked} setPicked={setPicked} errorId="err-songs" error={hasError("songs") ? error!.message : null} />
      </div>

      <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <legend className="mb-1 p-0 font-display text-[26px] leading-none font-extrabold uppercase">When and where</legend>
        <CityPicker cities={[{ id: "melbourne", name: "Melbourne", level: "live", note: "Taste, foot traffic, busking rules, events and weather" }]} value="melbourne" onValueChange={() => {}} />
        <div className="flex max-w-80 flex-col gap-1.5" data-field="slot">
          <DatePicker id="date" label="Date" value={slot.date} onChange={(date) => setSlot({ ...slot, date })} min={today} invalid={hasError("slot")} aria-describedby={errorId("slot")} />
          {hasError("slot") && (
            <FormMessage tone="error" id="err-slot" alert={false}>
              {error!.message}
            </FormMessage>
          )}
        </div>
        {/* anyTime stays off on this branch: dev/core turns it on at the merge (B-177). */}
        <TimeSlotPicker value={pickedSlot} onChange={(id) => { const q = QUICK_SLOTS.find((s) => s.id === id); if (q) setSlot({ ...slot, from: String(q.from), to: String(q.to) }); }} />
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
