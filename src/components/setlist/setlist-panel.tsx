import Link from "next/link";
import { AddToRepertoire } from "@/components/playlist/add-to-repertoire";
import { LearnItMenu } from "@/components/songs/learn-it-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/live-search";
import { ageLabel } from "@/lib/age";
import type { Plan, PlanPitch } from "@/lib/plan-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

/** Total length of the songs with a known length, and how many those are. */
export function setLength(setlist: PlanPitch["setlist"]): { ms: number; timed: number } {
  const timed = setlist.filter((s) => s.durationMs !== null);
  return { ms: timed.reduce((sum, s) => sum + (s.durationMs ?? 0), 0), timed: timed.length };
}

export function SetlistPanel({
  pitch,
  learnThese,
  ageLean = null,
  canAddToRepertoire = false,
  repertoireTotal = null,
}: {
  pitch: PlanPitch;
  learnThese: Plan["learnThese"];
  ageLean?: string | null;
  /** "Add to Repertoire" on each Songs to learn item. False on example runs: presets never write a Repertoire. */
  canAddToRepertoire?: boolean;
  /** How many songs the busk's Repertoire had (the request's songs): "N of M songs you can sing". Null: not known, no count shown. */
  repertoireTotal?: number | null;
}) {
  const length = setLength(pitch.setlist);
  // "Songs you can sing" are the act's own songs only: suggested ones are Busk Map's additions for this crowd.
  const youCanSing = pitch.setlist.filter((s) => s.origin === "repertoire").length;
  const suggested = pitch.setlist.length - youCanSing;
  const songs = (n: number) => `${n} song${n === 1 ? "" : "s"}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{PLAYLIST_COPY.suggestedSetFor(pitch.name)}</h2>
        </CardTitle>
        <CardDescription>
          Your songs, ordered by how much the crowd at this pitch likes each artist (Qloo), how well-known the song is (Last.fm) and how
          well its release year (Spotify) suits the crowd&apos;s age
          {ageLean ? ` (Qloo: your fans lean ${ageLabel(ageLean)})` : ""}. Qloo has no song-level data, so a song inherits its artist&apos;s
          affinity. The set opens with the best-known of the top three and never plays the same artist twice in a row, so the order is not
          strictly by score.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {repertoireTotal !== null && pitch.setlist.length > 0 && (
          <p data-testid="you-can-sing" className="text-muted-foreground">
            <span className="font-medium text-foreground">{youCanSing} of {repertoireTotal} songs you can sing</span>
            {suggested > 0 ? ` · ${suggested} suggested for this crowd` : ""} ·{" "}
            <Link className="underline" href="/repertoire">
              Edit your {PLAYLIST_COPY.name}
            </Link>
          </p>
        )}
        {pitch.setlist.length === 0 ? (
          <p className="text-muted-foreground">{PLAYLIST_COPY.suggestedSetEmpty}</p>
        ) : (
          <>
            <ol className="space-y-2">
              {pitch.setlist.map((song, i) => (
                <li key={song.songId} className="grid grid-cols-[2ch_1fr_auto] gap-x-3">
                  <span className="text-muted-foreground">{i + 1}</span>
                  <span>
                    <span className="font-medium">{song.title}</span>{" "}
                    <span className="text-muted-foreground">
                      ({song.artist}
                      {song.year !== null ? `, ${song.year}` : ""})
                    </span>
                    {song.own && (
                      <Badge variant="secondary" className="ml-2">
                        Your song
                      </Badge>
                    )}
                    {song.origin === "suggested" && (
                      <Badge variant="outline" className="ml-2" data-testid="suggested-tag">
                        Suggested
                      </Badge>
                    )}
                    <span className="block text-muted-foreground">{song.reason}</span>
                    {song.origin === "suggested" && song.suggestion && (
                      <span className="block text-muted-foreground" data-testid="suggestion-because">
                        {song.suggestion.because}{" "}
                        {song.suggestion.sourceUrl ? (
                          <a className="underline" href={song.suggestion.sourceUrl} target="_blank" rel="noreferrer">
                            {song.suggestion.source === "spotify" ? "On Spotify" : "On Last.fm"}
                          </a>
                        ) : (
                          `(from ${song.suggestion.source === "spotify" ? "Spotify" : "Last.fm"})`
                        )}
                      </span>
                    )}
                  </span>
                  <span className="flex items-start gap-2">
                    {song.durationMs !== null && (
                      <span className="text-muted-foreground tabular-nums" aria-label={`Length ${formatDuration(song.durationMs)}`}>
                        {formatDuration(song.durationMs)}
                      </span>
                    )}
                    <span aria-label={`Song score ${song.score} out of 100`}>{song.score}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p data-testid="set-length" className="text-muted-foreground">
              {length.timed === 0
                ? `${songs(pitch.setlist.length)}. Song lengths show for songs picked from Spotify search.`
                : length.timed === pitch.setlist.length
                  ? `Set length: ${formatDuration(length.ms)} (${songs(pitch.setlist.length)}).`
                  : `Set length: at least ${formatDuration(length.ms)} (${length.timed} of ${songs(pitch.setlist.length)} have a known length).`}
            </p>
          </>
        )}

        <section aria-label={PLAYLIST_COPY.toLearn}>
          <h3 className="font-medium">{PLAYLIST_COPY.toLearn}</h3>
          <p className="text-muted-foreground">
            Artists this crowd likes that you don&apos;t play yet, ranked by Qloo&apos;s audience growth, then trends, then affinity and
            Last.fm listeners.
          </p>
          {learnThese.length === 0 ? (
            <p className="text-muted-foreground">No suggestions for this crowd yet.</p>
          ) : (
            <ul className="space-y-1">
              {learnThese.map((s) => (
                <li key={s.artist} className="flex items-start justify-between gap-2">
                  <span>
                    <span className="font-medium">{s.title ?? "Any song"}</span> by {s.artist}
                    <span className="block text-muted-foreground">{s.reason}</span>
                    {s.title && canAddToRepertoire && <AddToRepertoire title={s.title} artist={s.artist} reason={s.reason} growth={s.audienceGrowth ?? null} />}
                  </span>
                  {s.title && <LearnItMenu title={s.title} artist={s.artist} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
