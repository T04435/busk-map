"use client";

import { ArtistChip } from "@/components/honeycomb/artist-chip";
import { Button } from "@/components/ui/button";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { QlooCandidateView } from "@/lib/qloo-match";

const R = PLAYLIST_COPY.research;
/** The results sections' heading style. */
export const RESEARCH_H2 = "m-0 font-display text-[26px] leading-none font-extrabold uppercase";
const FRAME = "w-full max-w-2xl space-y-3 border-t-2 border-rule pt-6";

/**
 * The run paused because no Qloo artist was certain to be the act: up to three plausible ones (photo, name, a genre or two) and
 * "None of these". The answer is saved with the Repertoire, so it is not asked again for this link.
 */
export function QlooCandidates({ candidates, busy, onPick, onNone }: { candidates: readonly QlooCandidateView[]; busy: boolean; onPick: (qlooId: string) => void; onNone: () => void }) {
  const C = R.candidates;
  return (
    <section aria-labelledby="qloo-candidates" className={FRAME} data-testid="research-candidates">
      <h2 id="qloo-candidates" className={RESEARCH_H2}>
        {C.heading}
      </h2>
      <p className="m-0 max-w-prose text-sm text-muted-foreground">{C.hint}</p>
      <ul aria-label={C.heading} className="m-0 grid list-none gap-1 p-0">
        {candidates.map((c) => (
          <li key={c.qlooId} data-testid="research-candidate" data-qloo-id={c.qlooId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border">
            <ArtistChip name={c.name} image={c.image} source="qloo" tags={c.genres.length ? c.genres : [C.noGenres]} className="min-w-0 flex-1 basis-60" />
            <Button type="button" variant="outline" size="sm" disabled={busy} aria-label={C.pickLabel(c.name)} onClick={() => onPick(c.qlooId)}>
              {C.pick}
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="ghost" size="sm" disabled={busy} data-testid="research-candidates-none" onClick={onNone}>
        {C.none}
      </Button>
    </section>
  );
}
