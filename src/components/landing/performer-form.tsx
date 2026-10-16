"use client";

import { ArrowRight, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CityPicker } from "@/components/forms/city-picker";
import { PermitPicker } from "@/components/forms/permit-picker";
import { TimeSlotPicker } from "@/components/forms/time-slot-picker";
import { FormMessage } from "@/components/honeycomb/form-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldLabel, planFormError } from "@/lib/form-errors";
import { planRequestSchema, type PlanRequest, type PlanRequestInput } from "@/lib/plan-schema";
import { planSearchParams } from "@/lib/plan-url";
import { weekSearchParams } from "@/lib/week-url";
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
      return;
    }
    setError(null);
    if (target === "week") {
      const { slot: planSlot, ...rest } = result.data;
      router.push(`/week?${weekSearchParams({ ...rest, startDate: planSlot.date, limits: { maxSessions: 5, maxPerDay: 1, unavailable: [] } }, null)}`);
      return;
    }
    void openPlan(result.data);
  }

  const errorId = (field: Field) => (error?.field === field ? `err-${field}` : undefined);
  const hasError = (field: Field) => error?.field === field;

  return (
    <form onSubmit={submit} className="flex flex-col gap-7 border-2 border-rule bg-card p-4 md:p-7" aria-label="Plan for your own act" noValidate>
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
        <div className="space-y-1.5">
          <ArtistPicker value={artists} onChange={setArtists} query={artistQuery} onQueryChange={setArtistQuery} />
          {hasError("artists") && (
            <FormMessage tone="error" id="err-artists" alert={false}>
              {error!.message}
            </FormMessage>
          )}
        </div>
      </section>

      <RepertoirePicker
        artists={artists}
        picked={picked}
        setPicked={setPicked}
        errorId="err-songs"
        error={hasError("songs") ? error!.message : null}
      />

      <fieldset className="m-0 flex min-w-0 flex-col gap-4.5 border-0 p-0">
        <legend className="mb-1 p-0 text-label font-bold">When and where</legend>
        <CityPicker cities={[{ id: "melbourne", name: "Melbourne", level: "live", note: "Taste, foot traffic, busking rules, events and weather" }]} value="melbourne" onValueChange={() => {}} />
        <TimeSlotPicker value={slot} onChange={setSlot} today={today} invalid={hasError("slot")} describedBy={errorId("slot")} />
        {hasError("slot") && (
          <FormMessage tone="error" id="err-slot" alert={false}>
            {error!.message}
          </FormMessage>
        )}
        <PermitPicker value={permit} onValueChange={setPermit} />
        {hasError("permit") && (
          <FormMessage tone="error" id="err-permit" alert={false}>
            {error!.message}
          </FormMessage>
        )}
      </fieldset>

      {error && (
        <Alert variant="error">
          <AlertTitle>{error.label}</AlertTitle>
          <AlertDescription>{error.detail}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-3 border-t border-border pt-5 max-sm:[&>button]:w-full">
        <Button type="submit" value="plan" size="lg" disabled={submitting}>
          Plan my busk
          <ArrowRight aria-hidden="true" />
        </Button>
        <Button type="submit" value="week" variant="outline" size="lg">
          <CalendarDays aria-hidden="true" />
          Plan my week from this date
        </Button>
      </div>
    </form>
  );
}
