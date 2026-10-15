"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DatePicker } from "@/components/forms/date-picker";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { planRequestSchema } from "@/lib/plan-schema";
import { planSearchParams } from "@/lib/plan-url";
import { weekSearchParams } from "@/lib/week-url";
import { formatHour } from "@/lib/slot";
import { formatDuration } from "@/lib/live-search";
import { ArtistPicker, typedArtists, type PickedArtist } from "./artist-picker";
import { SongCover, SongSearch } from "./song-search";

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

/** `today` is the city's local date: a plan is for today or later. */
export function PerformerForm({ defaultDate, today }: { defaultDate: string; today: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [artists, setArtists] = useState<PickedArtist[]>([]);
  const [artistQuery, setArtistQuery] = useState("");
  const [picked, setPicked] = useState<PickedSong[]>([]);
  const [songs, setSongs] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [from, setFrom] = useState("18");
  const [to, setTo] = useState("21");
  const [permit, setPermit] = useState("general");
  const [error, setError] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [spotifyLink, setSpotifyLink] = useState("");

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

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "week" ? "week" : "plan";
    const parsedSongs = [
      ...picked.map((p) => ({ title: p.title, artist: p.artist, own: p.own, ...(p.durationMs ? { durationMs: p.durationMs } : {}) })),
      ...parseSongLines(songs),
    ];
    const chosen = [...artists];
    for (const typed of typedArtists(artistQuery)) {
      if (!chosen.some((a) => a.name.toLowerCase() === typed.toLowerCase())) chosen.push({ name: typed, spotifyId: null, image: null });
    }
    const artistList = [
      ...new Set([...chosen.map((a) => a.name), ...parsedSongs.filter((s) => !s.own).map((s) => s.artist)]),
    ].slice(0, 10);
    const spotifyArtists = chosen.flatMap((a) => (a.spotifyId && artistList.includes(a.name) ? [{ name: a.name, id: a.spotifyId }] : []));
    if (date < today) {
      setError("Pick today or a later date.");
      return;
    }
    const result = planRequestSchema.safeParse({
      city: "melbourne",
      slot: { date, startHour: Number(from), endHour: Number(to) },
      permit,
      performer: { name: clean(name) || "My act", artists: artistList, spotifyArtists, songs: parsedSongs },
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
      <ArtistPicker value={artists} onChange={setArtists} query={artistQuery} onQueryChange={setArtistQuery} />

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium">Songs you can play</legend>
        <SongSearch onAdd={(track) => addSongs([toPicked(track, false)])} isAdded={(track) => picked.some((p) => p.key === track.id)} />
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
        <div className="flex gap-2">
          <Input aria-label="Your Spotify artist link" value={spotifyLink} onChange={(e) => setSpotifyLink(e.target.value)} placeholder="Your Spotify artist link (optional)" />
          <Button type="button" variant="outline" onClick={() => void loadOwnSongs()} disabled={spotifyLink.trim().length < 10}>
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
