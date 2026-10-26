"use client";

import { useId, useMemo, useState } from "react";
import { CityPicker } from "@/components/forms/city-picker";
import { DatePicker } from "@/components/forms/date-picker";
import { PermitPicker } from "@/components/forms/permit-picker";
import { ArtistProfile } from "@/components/honeycomb/artist-profile";
import { Icon } from "@/components/honeycomb/icon";
import { ArtistPicker, typedArtists, type PickedArtist } from "@/components/landing/artist-picker";
import { fillCount, startingArtists } from "@/components/landing/performer-form";
import { RepertoireSource } from "@/components/playlist/repertoire-source";
import { SoundsLikeSuggestionsList, withSuggested } from "@/components/playlist/sounds-like-suggestions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MELBOURNE_OPTION, requestFieldsOf, type CityOption } from "@/lib/city";
import { cityNow } from "@/lib/city-clock";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { PlaylistView, SpotifyProfile } from "@/lib/playlist-schema";
import { actGenresOf } from "@/lib/repertoire-research";
import { addDays } from "@/lib/slot";
import { profilePhoto } from "@/lib/spotify-profile";
import { hoursLabel, NAMED_SLOTS } from "@/lib/time-slots";
import { defaultWeekStart, WEEK_DAYS, weekDayLabel, weekRequestSchema, type WeekDayInput, type WeekRequest, type WeekRequestInput } from "@/lib/week-schema";

// "|" and "~" separate values in links.
const clean = (s: string) => s.replace(/[|~]/g, " ").trim();

/** A day's choice: any time (the default), one named slot, or can't play. */
type DayChoice = "any" | (typeof NAMED_SLOTS)[number]["id"] | "off";

const CHOICES: { id: DayChoice; label: string }[] = [
  { id: "any", label: "Any time" },
  ...NAMED_SLOTS.map((s) => ({ id: s.id, label: `${s.label} · ${hoursLabel(s.startHour, s.endHour)}` })),
  { id: "off", label: "Can't play" },
];

export function dayInput(date: string, choice: DayChoice): WeekDayInput {
  if (choice === "off") return { date, off: true };
  const slot = NAMED_SLOTS.find((s) => s.id === choice);
  return slot ? { date, startHour: slot.startHour, endHour: slot.endHour } : { date, any: true };
}

const profileOf = (profile: SpotifyProfile) => ({ name: profile.name, image: profilePhoto(profile.images), genres: profile.genres, audience: [], followers: profile.followers ?? null });

type Field = "name" | "artists" | "start" | "days" | "city";

function fieldOf(path: string): Field {
  if (path.startsWith("performer.name")) return "name";
  if (path.startsWith("days")) return "days";
  if (path === "startDate") return "start";
  if (path === "city" || path.startsWith("place")) return "city";
  return "artists";
}

const FIELD_LABEL: Record<Field, string> = { name: "Act name", artists: "Artists you sound like", start: "First day", days: "Your days", city: "City" };

/**
 * The week's form: the busk form's pieces (the act and its sound-alikes from the Repertoire, the city picker, the permit in
 * Melbourne only), a first day and the seven days, each any time (the default), a named slot or "Can't play". `now` is the
 * server's clock (an ISO instant), read in the picked city's time zone.
 */
export function WeekForm({ now, repertoire, onSubmit, busy = false }: { now: string; repertoire: PlaylistView | null; onSubmit: (request: WeekRequest) => void; busy?: boolean }) {
  const rep = repertoire;
  const [name, setName] = useState(rep?.actName ?? "");
  const [artists, setArtists] = useState<PickedArtist[]>(() => startingArtists(undefined, rep));
  const [artistQuery, setArtistQuery] = useState("");
  const songs = useMemo(() => (rep ? rep.songs.map((s) => ({ key: `rep-${s.id}`, title: s.title, artist: s.artist, durationMs: s.durationMs, own: s.own })) : []), [rep]);
  const [city, setCity] = useState<CityOption>(MELBOURNE_OPTION);
  const clock = cityNow(city.timeZone, now);
  const [start, setStart] = useState(() => defaultWeekStart(clock.today, clock.hour));
  const [startChosen, setStartChosen] = useState(false);
  const [choices, setChoices] = useState<DayChoice[]>(() => Array.from({ length: WEEK_DAYS }, () => "any"));
  const [permit, setPermit] = useState("general");
  const [error, setError] = useState<{ field: Field; message: string } | null>(null);
  const daysLabel = useId();

  function chosenArtists() {
    const chosen = artists.length > 0 ? [...artists] : startingArtists(undefined, rep);
    for (const typed of typedArtists(artistQuery)) if (!chosen.some((a) => a.name.toLowerCase() === typed.toLowerCase())) chosen.push({ name: typed, spotifyId: null, image: null });
    return chosen;
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const chosen = chosenArtists();
    const parsedSongs = songs.map((p) => ({ title: p.title, artist: p.artist, own: p.own, ...(p.durationMs ? { durationMs: p.durationMs } : {}) }));
    const artistList = [...new Set([...chosen.map((a) => a.name), ...parsedSongs.filter((s) => !s.own).map((s) => s.artist)])].slice(0, 10);
    if (start < clock.today) {
      setError({ field: "start", message: "First day: pick today or a later date." });
      return;
    }
    const fill = fillCount(parsedSongs.length);
    const genres = actGenresOf(rep?.research);
    const input: WeekRequestInput = {
      ...requestFieldsOf(city),
      permit: (city.id === MELBOURNE_OPTION.id ? permit : "general") as WeekRequestInput["permit"],
      startDate: start,
      days: choices.map((c, i) => dayInput(addDays(start, i), c)),
      performer: {
        name: clean(name) || "My act",
        artists: artistList,
        spotifyArtists: chosen.flatMap((a) => (a.spotifyId && artistList.includes(a.name) ? [{ name: a.name, id: a.spotifyId }] : [])),
        songs: parsedSongs,
        ...(fill ? { fillSuggested: fill } : {}),
        ...(rep?.qlooArtistId && rep.spotifyProfile?.name ? { ownArtist: { qlooId: rep.qlooArtistId, name: rep.spotifyProfile.name, ...(rep.spotifyArtistId ? { spotifyId: rep.spotifyArtistId } : {}) } } : {}),
        ...(genres.length ? { genreTags: genres } : {}),
      },
    };
    const result = weekRequestSchema.safeParse(input);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = fieldOf((issue?.path ?? []).map(String).join("."));
      const detail = field === "artists" ? "add at least one artist you sound like." : field === "days" ? "pick at least one day you can play." : (issue?.message ?? "check this field.");
      setError({ field, message: `${FIELD_LABEL[field]}: ${detail}` });
      return;
    }
    setError(null);
    onSubmit(result.data);
  }

  const has = (field: Field) => error?.field === field;

  return (
    <form onSubmit={submit} className="flex flex-col gap-7 border-2 border-rule bg-card p-4 md:p-7" aria-label="Plan my week" aria-busy={busy || undefined} noValidate data-testid="week-form">
      <section aria-label="Your act" className="flex flex-col gap-4.5">
        <div className="space-y-1.5">
          <Label htmlFor="week-name">Act name</Label>
          <Input id="week-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jess on acoustic guitar" maxLength={80} aria-invalid={has("name") || undefined} aria-describedby={has("name") ? "err-week" : undefined} />
        </div>
        <div className="space-y-1.5" data-field="artists">
          <ArtistPicker value={artists} onChange={setArtists} query={artistQuery} onQueryChange={setArtistQuery} />
        </div>
        <SoundsLikeSuggestionsList
          enabled={Boolean(rep?.spotifyArtistId)}
          refreshKey={`${rep?.qlooArtistId ?? ""}|${rep?.spotifyProfile?.fetchedAt ?? ""}`}
          picked={chosenArtists().map((a) => a.name)}
          onAdd={(add) => setArtists((current) => withSuggested(current, add))}
        />
      </section>

      <RepertoireSource
        heading={PLAYLIST_COPY.source.heading}
        songs={songs}
        hasRepertoire={Boolean(rep && rep.songs.length > 0)}
        header={rep?.spotifyArtistId && rep.spotifyProfile ? <ArtistProfile size="md" maxGenres={5} profile={profileOf(rep.spotifyProfile)} /> : null}
      />

      <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <legend className="mb-1 p-0 font-display text-[26px] leading-none font-extrabold uppercase">Where and when</legend>
        <CityPicker
          value={city}
          onChange={(next) => {
            setCity(next);
            if (!startChosen) {
              const at = cityNow(next.timeZone, now);
              setStart(defaultWeekStart(at.today, at.hour));
            }
          }}
        />
        <div className="flex max-w-80 flex-col gap-1.5">
          <DatePicker
            id="week-start"
            label="First day"
            value={start}
            onChange={(next) => {
              setStartChosen(true);
              setStart(next);
            }}
            min={clock.today}
            invalid={has("start")}
            aria-describedby={has("start") ? "err-week" : undefined}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2" role="group" aria-labelledby={daysLabel} data-testid="week-day-choices">
          <span id={daysLabel} className="text-[15px] leading-5 font-bold">
            Your days
          </span>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {choices.map((choice, i) => {
              const date = addDays(start, i);
              const id = `week-day-${i}`;
              return (
                <li key={i} className="flex min-w-0 flex-col gap-1">
                  <Label htmlFor={id} className="font-mono text-xs font-bold tracking-[0.06em] uppercase">
                    {weekDayLabel(date)}
                  </Label>
                  <Select value={choice} onValueChange={(v) => setChoices((all) => all.map((c, k) => (k === i ? (v as DayChoice) : c)))}>
                    <SelectTrigger id={id} className="w-full" data-testid="week-day-choice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHOICES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              );
            })}
          </ul>
        </div>
        {city.id === MELBOURNE_OPTION.id ? <PermitPicker value={permit} onValueChange={setPermit} /> : null}
      </fieldset>

      {error ? (
        <Alert variant="error" data-testid="week-form-error">
          <AlertTitle>{FIELD_LABEL[error.field]}</AlertTitle>
          <AlertDescription id="err-week">{error.message.slice(FIELD_LABEL[error.field].length + 2)}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-3 border-t-2 border-rule pt-5 max-sm:[&>button]:w-full">
        <Button type="submit" size="lg" disabled={busy} data-testid="week-submit">
          Plan my week
          <Icon name="arrow-right" size={18} />
        </Button>
      </div>
    </form>
  );
}
