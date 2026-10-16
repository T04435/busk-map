"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";
import type { PlaylistView } from "@/lib/playlist-schema";
import { plannerPerformer, songsMatchRepertoire } from "@/lib/repertoire-prefill";
import type { WeekRequest } from "@/lib/week-schema";
import { weekSearchParams } from "@/lib/week-url";

/**
 * "Use my Repertoire" on /week (docs/playlist-architecture.md §3.1): a plain switch. On, the week is planned from the
 * Repertoire's songs and artists; off, it goes back to the act the page was opened with. Like every week control it
 * changes the URL, so the request stays a full snapshot and the Repertoire's id is never in it. This component sits
 * outside the plan's keyed view so it remembers the act it replaced. Not shown for example weeks, nor with no songs.
 */
export function WeekRepertoire({ repertoire, request }: { repertoire: PlaylistView; request: WeekRequest }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const before = useRef<WeekRequest["performer"] | null>(null);
  const on = songsMatchRepertoire(request.performer.songs, repertoire);

  function toggle(next: boolean) {
    let performer: WeekRequest["performer"];
    if (next) {
      before.current = request.performer;
      performer = plannerPerformer(repertoire, request.performer.name);
    } else {
      // Back to the act the page was opened with; if it was opened from the Repertoire, the same artists without its songs.
      performer = before.current ?? { ...request.performer, songs: [] };
    }
    const params = weekSearchParams({ ...request, performer }, null);
    const faults = current.get("faults");
    if (faults) params.set("faults", faults);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="week-use-repertoire">
      <Switch id="week-use-repertoire" checked={on} onCheckedChange={toggle} />
      <Label htmlFor="week-use-repertoire">{COPY.mineWithCount(repertoire.songs.length)}</Label>
      <span className="text-sm text-muted-foreground">{COPY.weekToggleHint}</span>
    </div>
  );
}
