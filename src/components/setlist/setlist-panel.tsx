import Link from "next/link";
import { artist as mentionArtist } from "@/lib/mention";
import { reasonSlots } from "@/components/setlist/reason-slots";
import { Icon } from "@/components/honeycomb/icon";
import { AddToRepertoire } from "@/components/playlist/add-to-repertoire";
import { CopySetButton } from "@/components/setlist/copy-set-button";
import { SongActions } from "@/components/honeycomb/song-actions";
import { SongRow } from "@/components/honeycomb/song-row";
import { SongTag } from "@/components/honeycomb/song-tag";
import { formatDuration } from "@/lib/live-search";
import { SPOTIFY_TRACK_URL, spotifyHref } from "@/lib/mention";
import type { Plan, PlanPitch } from "@/lib/plan-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

/** The parts of a plan's song and "learn these" entry the panel shows, so the landing can feed it labelled example data. */
type SetlistSong = Pick<PlanPitch["setlist"][number], "songId" | "title" | "artist" | "own" | "score" | "reason" | "durationMs" | "year"> &
  Partial<Pick<PlanPitch["setlist"][number], "origin" | "suggestion" | "artistImage" | "filledBy">>;
type LearnThese = (Pick<Plan["learnThese"][number], "artist" | "title" | "reason"> & Partial<Pick<Plan["learnThese"][number], "audienceGrowth" | "artistImage" | "filledBy">>)[];

/** A suggested song's Spotify link: its track URL, else built from the track id; Last.fm (or no) source means no link (U06). */
const suggestionHref = (s: SetlistSong["suggestion"] | undefined): string | undefined =>
  (s && (spotifyHref(s.sourceUrl) ?? (s.spotifyTrackId && /^[A-Za-z0-9]{22}$/.test(s.spotifyTrackId) ? SPOTIFY_TRACK_URL(s.spotifyTrackId) : null))) || undefined;

/** Total length of the songs with a known length, and how many those are. */
export function setLength(setlist: Pick<SetlistSong, "durationMs">[]): { ms: number; timed: number } {
  const timed = setlist.filter((s) => s.durationMs !== null);
  return { ms: timed.reduce((sum, s) => sum + (s.durationMs ?? 0), 0), timed: timed.length };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The set as plain text, for the preview's Copy button. */
function setAsText(setlist: SetlistSong[]): string {
  return [
    PLAYLIST_COPY.suggestedSet,
    // unify-ok: the clipboard text of the set, not a display
    ...setlist.map((s, i) => `${pad(i + 1)} ${s.title} - ${s.artist}${s.year !== null ? `, ${s.year}` : ""}${s.durationMs !== null ? ` (${formatDuration(s.durationMs)})` : ""}`),
  ].join("\n");
}

/**
 * "plan" (default): the plan page's panel. "preview": the landing's example, as the board draws it: a generic heading with a Copy
 * button, rows 01–04, the set length in mono, and Songs to learn as a bordered box with an orange top rule.
 * On a plan, songs Busk Map suggested for this crowd carry a Suggested tag with the because text and its source, and the
 * header counts the songs you can sing ("N of M songs you can sing").
 */
export function SetlistPanel({
  pitch,
  learnThese,
  variant = "plan",
  canAddToRepertoire = false,
  repertoireTotal = null,
  when,
}: {
  pitch: { name: string; setlist: SetlistSong[]; window?: { label: string } | null };
  learnThese: LearnThese;
  variant?: "plan" | "preview";
  /** The day and time of the busk ("Sat 12–3 pm"), the line under the heading. Without it the pitch's own best window shows, or nothing. */
  when?: string;
  /** "Add to Repertoire" on each Songs to learn item. False on example runs: presets never write a Repertoire. */
  canAddToRepertoire?: boolean;
  /** How many songs the busk's Repertoire had (the request's songs): "N of M songs you can sing". Null: not known, no count shown. */
  repertoireTotal?: number | null;
}) {
  // The board's panel for both: the landing's example ("preview") and a real pitch ("plan", which names its pitch and explains the order).
  return (
    <SetlistPreview
      pitch={pitch}
      learnThese={learnThese}
      real={variant === "plan"}
      canAddToRepertoire={canAddToRepertoire}
      repertoireTotal={variant === "plan" ? repertoireTotal : null}
      when={when}
    />
  );
}

function SetlistPreview({
  pitch,
  learnThese,
  real = false,
  canAddToRepertoire = false,
  repertoireTotal = null,
  when,
}: {
  pitch: { name: string; setlist: SetlistSong[]; window?: { label: string } | null };
  learnThese: LearnThese;
  real?: boolean;
  canAddToRepertoire?: boolean;
  repertoireTotal?: number | null;
  when?: string;
}) {
  const length = setLength(pitch.setlist);
  // "Songs you can sing" are the act's own songs only: suggested ones are Busk Map's additions for this crowd.
  const youCanSing = pitch.setlist.filter((s) => (s.origin ?? "repertoire") === "repertoire").length;
  const suggested = pitch.setlist.length - youCanSing;
  const songs = (n: number) => `${n} song${n === 1 ? "" : "s"}`;
  const lengthLine =
    length.timed === 0
      ? songs(pitch.setlist.length)
      : length.timed === pitch.setlist.length
        ? `Set length ${formatDuration(length.ms)} · ${songs(pitch.setlist.length)}`
        : `Set length at least ${formatDuration(length.ms)} · ${length.timed} of ${songs(pitch.setlist.length)} have a known length`;
  return (
    <section aria-label={PLAYLIST_COPY.suggestedSet} className="space-y-4 border-2 border-rule bg-card p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-72 space-y-2">
          <h3 className="m-0 font-display text-[28px] leading-none font-extrabold uppercase">{real ? PLAYLIST_COPY.suggestedSetFor(pitch.name) : `${PLAYLIST_COPY.suggestedSet} for this pitch`}</h3>
          {real && (when ?? pitch.window?.label) ? <p className="m-0 text-sm text-muted-foreground">{when ?? pitch.window?.label}</p> : null}
          {repertoireTotal !== null && pitch.setlist.length > 0 && (
            <p data-testid="you-can-sing" className="m-0 text-sm text-muted-foreground">
              <b className="font-bold text-foreground">
                {youCanSing} of {repertoireTotal} songs you can sing
              </b>
              {suggested > 0 ? ` · ${suggested} suggested for this crowd` : ""} ·{" "}
              <Link className="font-bold text-foreground underline underline-offset-3 hover:decoration-2" href="/repertoire">
                Edit your {PLAYLIST_COPY.name}
              </Link>
            </p>
          )}
        </div>
        <CopySetButton text={setAsText(pitch.setlist)} />
      </header>
      {pitch.setlist.length === 0 ? (
        <p className="m-0 text-muted-foreground">{PLAYLIST_COPY.suggestedSetEmpty}</p>
      ) : (
        <>
          <ol className="m-0 flex list-none flex-col p-0">
            {pitch.setlist.map((song, i) => (
              <SongRow
                key={song.songId}
                index={i + 1}
                title={song.title}
                artist={song.artist}
                year={song.year}
                durationMs={song.durationMs}
                image={song.suggestion?.image}
                artistImage={song.artistImage}
                filledBy={song.filledBy}
                href={suggestionHref(song.suggestion)}
                source={song.suggestion?.source}
                score={song.score}
                scoreLabel="Fit"
                className="border-b border-border last:border-b-0"
                tags={song.origin === "suggested" ? <span data-testid="suggested-tag"><SongTag kind="suggested" /></span> : undefined}
                {...reasonSlots(song.reason, [mentionArtist(song.artist, { image: song.artistImage })])}
              >
                {song.origin === "suggested" && song.suggestion && (
                  <span className="block text-sm text-muted-foreground" data-testid="suggestion-because">
                    {song.suggestion.because}
                  </span>
                )}
              </SongRow>
            ))}
          </ol>
          <p data-testid="set-length" className="m-0 border-t-2 border-rule pt-3 font-mono text-sm font-medium">
            {lengthLine}
          </p>
        </>
      )}

      <section aria-label={PLAYLIST_COPY.toLearn} className="space-y-2 border-t-2 border-rule pt-4">
        <h4 className="m-0 flex items-center gap-2 font-display text-lg font-extrabold tracking-[0.02em] uppercase">
          <Icon name="learn" size={18} />
          {PLAYLIST_COPY.toLearn}
        </h4>
        {learnThese.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">No suggestions for this crowd yet.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col p-0">
            {learnThese.map((s, i) => (
              <SongRow
                key={s.artist}
                index={i + 1}
                title={s.title ?? "Any song"}
                artist={s.artist}
                artistImage={s.artistImage}
                filledBy={s.filledBy}
                className="border-b border-border last:border-b-0"
                {...reasonSlots(s.reason, [mentionArtist(s.artist, { image: (s as { artistImage?: string | null }).artistImage })])}
                actions={s.title ? <SongActions title={s.title} artist={s.artist} learnIt /> : undefined}
              >
                {s.title && canAddToRepertoire && <AddToRepertoire title={s.title} artist={s.artist} reason={s.reason} growth={s.audienceGrowth ?? null} />}
              </SongRow>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
