"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatDuration } from "@/lib/live-search";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";

/** A song on the busk form: from the Repertoire (or the last busk's, when planning again). */
export type SourceSong = { key: string; title: string; artist: string; durationMs: number | null; own: boolean };

/**
 * RepertoireSource: the busk form's READ-ONLY Repertoire block. With songs: "Your Repertoire · N songs · about X min" and a
 * link to edit it on /repertoire. Without: a "Create your Repertoire" link; the busk still plans, with suggested songs only.
 * Nothing here changes the Repertoire or the songs the busk carries.
 */
export function RepertoireSource({ heading, songs, hasRepertoire, header }: { heading: string; songs: readonly SourceSong[]; hasRepertoire: boolean; header?: ReactNode }) {
  const timed = songs.filter((s) => s.durationMs !== null);
  const length = timed.length > 0 ? formatDuration(timed.reduce((sum, s) => sum + (s.durationMs ?? 0), 0)) : null;

  return (
    <section aria-label={heading} data-testid="repertoire-source" className="flex flex-col gap-3 border-2 border-rule bg-card p-3.5">
      {header}
      {songs.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-label font-bold" data-testid="repertoire-summary">
            {heading} · {COPY.source.summary(songs.length, length)}
          </h3>
          <Link className="text-sm underline" href="/repertoire" data-testid="repertoire-link">
            {hasRepertoire ? COPY.source.edit : COPY.source.create}
          </Link>
        </div>
      ) : (
        <p className="m-0 text-sm text-muted-foreground" data-testid="repertoire-empty">
          <span className="font-medium text-foreground">{COPY.source.empty}.</span> {COPY.source.emptyHint}{" "}
          <Link className="underline" href="/repertoire" data-testid="repertoire-link">
            {COPY.source.create}
          </Link>
        </p>
      )}
    </section>
  );
}
