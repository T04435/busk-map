"use client";

import Link from "next/link";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatDuration } from "@/lib/live-search";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";

/** A song in the block: from the Repertoire (or the last busk), or added just for this busk. */
export type SourceSong = { key: string; title: string; artist: string; durationMs: number | null; own: boolean };

/**
 * RepertoireSource (BRAND playlist components.md): ONE block on the busk form. The summary reads "Your Repertoire · N songs" with
 * "Edit for this busk". Editing shows a checklist (Select all, Remove all), "+ Add a song just for this busk", and an explicit save.
 * What you remove is filled by suggested songs for each crowd; after Remove all the busk gets suggested songs only.
 * The parent owns the state; this draws it. Plain shadcn: the Honeycomb look arrives with the brand sync.
 */
export function RepertoireSource<T extends SourceSong>({
  heading,
  base,
  removed,
  added,
  editing,
  onEditingChange,
  onRemovedChange,
  onAddedChange,
  addSlot,
  save,
}: {
  heading: string;
  base: T[];
  removed: ReadonlySet<string>;
  added: T[];
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onRemovedChange: (removed: Set<string>) => void;
  onAddedChange: (added: T[]) => void;
  /** The "Add a song just for this busk" flow (RepertoireAdd). */
  addSlot: ReactNode;
  /** The explicit save to the Repertoire, when there is one to save to and something changed. */
  save: { edited: boolean; busy: boolean; onSave: () => void; onReset: () => void; note: ReactNode } | null;
}) {
  const kept = base.filter((s) => !removed.has(s.key));
  const sent = [...kept, ...added];
  const timed = sent.filter((s) => s.durationMs !== null);
  const length = timed.length > 0 ? formatDuration(timed.reduce((sum, s) => sum + (s.durationMs ?? 0), 0)) : null;
  const removedAny = removed.size > 0;
  const edited = removedAny || added.length > 0;
  const empty = base.length === 0 && added.length === 0;
  const allGone = sent.length === 0 && !empty;

  return (
    <section aria-label={heading} data-testid="repertoire-source" className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium" data-testid="repertoire-summary">
          {heading} · {COPY.source.summary(base.length, length)}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {edited && <Badge variant="secondary">{COPY.editedForBusk}</Badge>}
          {!editing && (
            <Button type="button" variant="outline" size="sm" aria-expanded={false} onClick={() => onEditingChange(true)}>
              {COPY.source.edit}
            </Button>
          )}
        </div>
      </div>

      {base.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="repertoire-empty">
          <span className="font-medium text-foreground">{COPY.source.empty}.</span> {COPY.source.emptyHint}{" "}
          <Link className="underline" href="/repertoire">
            {COPY.source.build}
          </Link>
        </p>
      )}

      {!editing && edited && !allGone && <p className="text-sm text-muted-foreground">{COPY.source.editedSummary(sent.length, base.length + added.length)}</p>}
      {!editing && allGone && (
        <p className="text-sm text-muted-foreground" data-testid="suggested-only">
          <span className="font-medium text-foreground">{COPY.source.suggestedOnlyTitle}.</span> {COPY.source.suggestedOnly}
        </p>
      )}

      {editing && (
        <div className="space-y-3" data-testid="repertoire-editor">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
              {COPY.source.selected(sent.length, base.length + added.length)}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => onRemovedChange(new Set())} disabled={!removedAny}>
              {COPY.source.selectAll}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sent.length === 0}
              onClick={() => {
                onRemovedChange(new Set(base.map((s) => s.key)));
                onAddedChange([]);
              }}
            >
              {COPY.source.removeAll}
            </Button>
          </div>
          {base.length + added.length > 0 && (
            <ul aria-label={COPY.source.listLabel} className="divide-y rounded-lg border text-sm">
              {base.map((song) => (
                <li key={song.key} className="flex items-center gap-2 px-2 py-1.5">
                  <Checkbox
                    id={`rep-${song.key}`}
                    checked={!removed.has(song.key)}
                    onCheckedChange={(on) => {
                      const next = new Set(removed);
                      if (on) next.delete(song.key);
                      else next.add(song.key);
                      onRemovedChange(next);
                    }}
                  />
                  <Label htmlFor={`rep-${song.key}`} className="min-w-0 flex-1 cursor-pointer font-normal">
                    <span className="block truncate font-medium">{song.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{song.artist}</span>
                  </Label>
                  {song.own && <Badge variant="secondary">{COPY.yourSong}</Badge>}
                  {song.durationMs !== null && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.durationMs)}</span>}
                </li>
              ))}
              {added.map((song) => (
                <li key={song.key} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{song.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{song.artist}</span>
                  </span>
                  <Badge variant="outline">{COPY.source.justForBusk}</Badge>
                  {song.own && <Badge variant="secondary">{COPY.yourSong}</Badge>}
                  {song.durationMs !== null && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.durationMs)}</span>}
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${song.title}`} onClick={() => onAddedChange(added.filter((a) => a.key !== song.key))}>
                    <XIcon aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {allGone && (
            <p className="text-sm text-muted-foreground" data-testid="suggested-only">
              <span className="font-medium text-foreground">{COPY.source.suggestedOnlyTitle}.</span> {COPY.source.suggestedOnly}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{COPY.source.fillHint}</p>

          <details className="group rounded-lg border p-3" data-testid="add-for-busk">
            <summary className="cursor-pointer text-sm font-medium">{COPY.source.addJustForBusk}</summary>
            <div className="mt-3">{addSlot}</div>
          </details>

          {save && save.edited && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">{COPY.editedHint}</p>
              <Button type="button" variant="outline" size="sm" disabled={save.busy} onClick={save.onSave}>
                {save.busy ? COPY.saving : allGone ? COPY.source.removeFromRepertoireToo : COPY.saveChanges}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={save.busy} onClick={save.onReset}>
                Back to my {COPY.name}
              </Button>
            </div>
          )}
          <Button type="button" size="sm" onClick={() => onEditingChange(false)}>
            {COPY.source.done}
          </Button>
        </div>
      )}
      {save?.note}
    </section>
  );
}
