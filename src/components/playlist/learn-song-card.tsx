"use client";

import { SongCover } from "@/components/landing/song-search";
import { LearnItMenu } from "@/components/songs/learn-it-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/live-search";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { LearnSuggestionView } from "@/lib/playlist-schema";

const COPY = PLAYLIST_COPY.learn;

/**
 * One suggestion (docs/playlist-architecture.md §7.3): title, artist, the model's reason, Qloo's "because", the evidence
 * chips (builds on, the crowd, growth, rising), year, cover and source, the "New this run" badge, and the actions:
 * Learned and Not for me on a pending song, Undo on a learned or dismissed one. Plain shadcn; the look comes later.
 */
export function LearnSongCard({
  song,
  busy,
  onStatus,
}: {
  song: LearnSuggestionView;
  busy: boolean;
  onStatus: (song: LearnSuggestionView, status: "pending" | "learned" | "dismissed") => void;
}) {
  const builds = song.basedOn.filter((b) => b.kind === "learned");
  const crowd = song.basedOn.filter((b) => b.kind === "crowd");
  return (
    <li className="space-y-2 py-4" data-testid="learn-card" data-song={song.title} data-artist={song.artist} data-status={song.status}>
      <div className="flex items-start gap-3">
        <SongCover image={song.image} className="mt-0.5 size-12" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium break-words">{song.title}</span>
            {song.isNew && song.status === "pending" && <Badge>{PLAYLIST_COPY.newThisRun}</Badge>}
            {song.status === "learned" && <Badge variant="secondary">{COPY.learnedBadge}</Badge>}
          </p>
          <p className="text-sm text-muted-foreground break-words">
            {song.artist}
            {song.year !== null && ` · ${song.year}`}
            {song.durationMs !== null && ` · ${formatDuration(song.durationMs)}`}
          </p>
        </div>
      </div>
      <p className="text-sm break-words">{song.reason}</p>
      {song.because && <p className="text-sm text-muted-foreground break-words">{song.because}</p>}
      <ul aria-label="Evidence" className="flex flex-wrap gap-1.5 empty:hidden">
        {builds.map((b) => (
          <li key={`b-${b.name}`}>
            <Badge variant="outline">{COPY.buildsOn(b.name)}</Badge>
          </li>
        ))}
        {crowd.map((b) => (
          <li key={`c-${b.name}`}>
            <Badge variant="outline">{COPY.crowdAt(b.name)}</Badge>
          </li>
        ))}
        {song.growth !== null && (
          <li>
            <Badge variant="outline">{COPY.growth}</Badge>
          </li>
        )}
        {song.trendDelta !== null && (
          <li>
            <Badge variant="outline">{COPY.rising(song.trendDelta)}</Badge>
          </li>
        )}
        <li>
          <Badge variant="outline">{COPY.source[song.songSource]}</Badge>
        </li>
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        {song.status === "pending" ? (
          <>
            <Button type="button" size="sm" disabled={busy} data-focus-id={`learned-${song.id}`} aria-label={`${COPY.learnedBtn}: ${song.title} by ${song.artist}`} onClick={() => onStatus(song, "learned")}>
              {COPY.learnedBtn}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} data-focus-id={`dismiss-${song.id}`} aria-label={`${COPY.notForMe}: ${song.title} by ${song.artist}`} onClick={() => onStatus(song, "dismissed")}>
              {COPY.notForMe}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={busy} data-focus-id={`undo-${song.id}`} aria-label={`${COPY.undo}: ${song.title} by ${song.artist}`} onClick={() => onStatus(song, "pending")}>
            {COPY.undo}
          </Button>
        )}
        <LearnItMenu title={song.title} artist={song.artist} />
      </div>
    </li>
  );
}
