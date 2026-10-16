import { GraduationCap } from "lucide-react";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { WithCells } from "@/components/honeycomb/with-cells";
import { LearnItMenu } from "@/components/songs/learn-it-menu";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/live-search";
import { ageLabel } from "@/lib/age";
import type { Plan, PlanPitch } from "@/lib/plan-schema";

/** Total length of the songs with a known length, and how many those are. */
export function setLength(setlist: PlanPitch["setlist"]): { ms: number; timed: number } {
  const timed = setlist.filter((s) => s.durationMs !== null);
  return { ms: timed.reduce((sum, s) => sum + (s.durationMs ?? 0), 0), timed: timed.length };
}

export function SetlistPanel({ pitch, learnThese, ageLean = null }: { pitch: PlanPitch; learnThese: Plan["learnThese"]; ageLean?: string | null }) {
  const length = setLength(pitch.setlist);
  const songs = (n: number) => `${n} song${n === 1 ? "" : "s"}`;
  return (
    <section aria-label="Suggested set" className="space-y-4 border-2 border-rule bg-card p-4 md:p-6">
      <header className="space-y-1">
        <h3 className="m-0 font-display text-[28px] leading-none font-extrabold uppercase">Setlist for {pitch.name}</h3>
        <p className="m-0 text-sm text-muted-foreground">
          Your songs, ordered by how much the crowd at this pitch likes each artist (Qloo), how well-known the song is (Last.fm) and how well its release year
          (Spotify) suits the crowd&apos;s age{ageLean ? ` (Qloo: your fans lean ${ageLabel(ageLean)})` : ""}. Qloo has no song-level data, so a song inherits its artist&apos;s
          affinity. The set opens with the best-known of the top three and never plays the same artist twice in a row, so the order is not strictly by score.
        </p>
      </header>
      {pitch.setlist.length === 0 ? (
        <p className="m-0 text-muted-foreground">Add songs you can play to get a setlist.</p>
      ) : (
        <>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {pitch.setlist.map((song, i) => (
              <li key={song.songId} className="grid grid-cols-[2ch_1fr_auto] items-start gap-x-3 border-b border-border pb-3 last:border-b-0">
                <span className="font-mono text-muted-foreground">{i + 1}</span>
                <span className="min-w-0">
                  <span className="font-bold">{song.title}</span>{" "}
                  <span className="text-muted-foreground">
                    · {song.artist}
                    {song.year !== null ? `, ${song.year}` : ""}
                  </span>
                  {song.own && (
                    <Badge variant="solid" className="ml-2">
                      Your song
                    </Badge>
                  )}
                  <span className="block text-sm text-muted-foreground">
                    <WithCells text={song.reason} />
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {song.durationMs !== null && (
                    <span className="font-mono text-sm text-muted-foreground tabular-nums" aria-label={`Length ${formatDuration(song.durationMs)}`}>
                      {formatDuration(song.durationMs)}
                    </span>
                  )}
                  <PercentCell value={song.score} size={40} label="Fit" />
                </span>
              </li>
            ))}
          </ol>
          <p data-testid="set-length" className="m-0 border-t-2 border-rule pt-3 text-sm">
            {length.timed === 0
              ? `${songs(pitch.setlist.length)}. Song lengths show for songs picked from Spotify search.`
              : length.timed === pitch.setlist.length
                ? `Set length: ${formatDuration(length.ms)} (${songs(pitch.setlist.length)}).`
                : `Set length: at least ${formatDuration(length.ms)} (${length.timed} of ${songs(pitch.setlist.length)} have a known length).`}
          </p>
        </>
      )}

      <section aria-label="Learn these" className="space-y-2 bg-secondary p-4">
        <h4 className="m-0 flex items-center gap-2 font-bold">
          <GraduationCap aria-hidden="true" className="size-5" />
          Learn these
        </h4>
        <p className="m-0 text-sm text-muted-foreground">
          Artists this crowd likes that you don&apos;t play yet, ranked by Qloo&apos;s audience growth, then trends, then affinity and Last.fm listeners.
        </p>
        {learnThese.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">No suggestions for this crowd yet.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {learnThese.map((s, i) => (
              <li key={s.artist} className="flex items-start justify-between gap-2">
                <span>
                  <b className="mr-2 font-mono">{i + 1}</b>
                  <span className="font-bold">{s.title ?? "Any song"}</span> by {s.artist}
                  <span className="block text-sm text-muted-foreground">
                    <WithCells text={s.reason} size={30} />
                  </span>
                </span>
                {s.title && <LearnItMenu title={s.title} artist={s.artist} />}
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
