"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { planRequestSchema } from "@/lib/plan-schema";
import { planSearchParams } from "@/lib/plan-url";
import { weekSearchParams } from "@/lib/week-url";
import { formatHour } from "@/lib/slot";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
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

type Found = { id: string; title: string; artists: { name: string }[] };

export function PerformerForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [artists, setArtists] = useState("");
  const [songs, setSongs] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [from, setFrom] = useState("18");
  const [to, setTo] = useState("21");
  const [permit, setPermit] = useState("general");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [spotifyLink, setSpotifyLink] = useState("");

  async function search() {
    setSearchNote("Searching…");
    const res = await fetch(`/api/repertoire?${new URLSearchParams({ type: "tracks", q: query })}`).catch(() => null);
    const body = res?.ok ? await res.json() : null;
    setFound(body?.tracks ?? []);
    setSearchNote(!body || body.mode === "fallback" ? "Song search is unavailable; type your songs below instead." : body.tracks.length ? null : "No songs found.");
  }

  async function loadOwnSongs() {
    setSearchNote("Loading your songs from Spotify…");
    const res = await fetch(`/api/repertoire?${new URLSearchParams({ type: "artist", link: spotifyLink })}`).catch(() => null);
    const body = res?.ok ? await res.json() : null;
    const tracks: Found[] = body?.tracks ?? [];
    if (!tracks.length) {
      setSearchNote("Couldn't load songs from that link. Paste an open.spotify.com/artist/… link, or type your songs.");
      return;
    }
    setSongs((current) => [current.trim(), ...tracks.slice(0, 20).map((t) => `${t.title} - ${t.artists[0]?.name ?? ""} (own)`)].filter(Boolean).join("\n"));
    setSearchNote(`Added ${Math.min(tracks.length, 20)} of your songs. Remove any you don't play.`);
  }

  function addSong(track: Found) {
    setSongs((current) => [current.trim(), `${track.title} - ${track.artists[0]?.name ?? ""}`].filter(Boolean).join("\n"));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "week" ? "week" : "plan";
    const parsedSongs = parseSongLines(songs);
    const artistList = [
      ...new Set([
        ...artists.split(/[,\n]/).map(clean).filter(Boolean),
        ...parsedSongs.filter((s) => !s.own).map((s) => s.artist),
      ]),
    ].slice(0, 10);
    const result = planRequestSchema.safeParse({
      city: "melbourne",
      slot: { date, startHour: Number(from), endHour: Number(to) },
      permit,
      performer: { name: clean(name) || "My act", artists: artistList, songs: parsedSongs },
    });
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join("."));
      setError(
        fields.some((f) => f.startsWith("performer.artists"))
          ? "Add at least one artist you sound like."
          : fields.some((f) => f.startsWith("slot"))
            ? "Check the date and times: the slot must end after it starts and last at most 6 hours."
            : "Check the form and try again.",
      );
      return;
    }
    setError(null);
    if (target === "week") {
      const { slot, ...rest } = result.data;
      router.push(`/week?${weekSearchParams({ ...rest, startDate: slot.date, limits: { maxSessions: 5, maxPerDay: 1, unavailable: [] } }, null)}`);
      return;
    }
    router.push(`/plan?${planSearchParams(result.data, { run: "1" })}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Plan for your own act">
      <div className="space-y-1">
        <Label htmlFor="name">Act name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jess on acoustic guitar" maxLength={80} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="artists">Artists you sound like</Label>
        <Input id="artists" value={artists} onChange={(e) => setArtists(e.target.value)} placeholder="Paul Kelly, Courtney Barnett" />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Songs you can play</legend>
        <div className="flex gap-2">
          <Input aria-label="Search songs on Spotify" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search songs" />
          <Button type="button" variant="outline" onClick={() => void search()} disabled={query.trim().length < 2}>
            Search
          </Button>
        </div>
        {found.length > 0 && (
          <ul className="space-y-1 text-sm">
            {found.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span>
                  {t.title} <span className="text-muted-foreground">({t.artists.map((a) => a.name).join(", ")})</span>
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => addSong(t)}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input aria-label="Your Spotify artist link" value={spotifyLink} onChange={(e) => setSpotifyLink(e.target.value)} placeholder="Your Spotify artist link (optional)" />
          <Button type="button" variant="outline" onClick={() => void loadOwnSongs()} disabled={spotifyLink.trim().length < 10}>
            Load my songs
          </Button>
        </div>
        {searchNote && <p className="text-sm text-muted-foreground" aria-live="polite">{searchNote}</p>}
        <Label htmlFor="songs" className="sr-only">
          Song list
        </Label>
        <Textarea
          id="songs"
          value={songs}
          onChange={(e) => setSongs(e.target.value)}
          rows={6}
          placeholder={"One per line: Title - Artist\nHow to Make Gravy - Paul Kelly\nMy Song - Me (own)"}
        />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger id="from" className="w-full">
              <SelectValue />
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
              <SelectValue />
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
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="circle-act">Circle act</SelectItem>
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
        <Button type="submit" value="plan">
          Plan my set
        </Button>
        <Button type="submit" value="week" variant="outline">
          Plan my week from this date
        </Button>
      </div>
    </form>
  );
}
