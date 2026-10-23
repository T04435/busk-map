"use client";

import { Fragment } from "react";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Spinner } from "@/components/ui/spinner";
import type { LearnLive } from "@/lib/learn-live";
import { funnelOf } from "@/lib/learn-plain";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

const COPY = PLAYLIST_COPY.learn;

/**
 * The research funnel in its learn mode (inventory F04; the DS ResearchFunnel's LearnFunnel): Qloo calls, artists matched,
 * crowds read, artists liked, songs checked, left out (a dashed cell; ONE count: suggested before + dismissed + already sung),
 * then new songs, which shows a loader until the picks are accepted. Honeycomb cells joined by the signal half-hex link.
 */
export function ResearchFunnel({ kind, totals, running }: { kind: "learn"; totals: LearnLive["totals"]; running: boolean }) {
  const items = funnelOf(totals);
  return (
    <section data-testid="learn-totals" data-kind={kind} aria-live={running ? "polite" : "off"} className="space-y-2">
      <h4 className="m-0 font-mono text-[11px] leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase">{COPY.totalsHeading}</h4>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-1.5 p-0" aria-label={COPY.totalsHeading}>
        {items.map((item, i) => {
          const last = item.key === "newSongs";
          const choosing = last && running && item.value === 0;
          const text = String(item.value);
          return (
            <Fragment key={item.key}>
              <li
                data-total={item.key}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[13px] leading-4 whitespace-nowrap text-muted-foreground",
                  last && "text-sm font-bold text-foreground",
                )}
              >
                <HexCell
                  size={last ? 34 : 30}
                  tone={item.key === "leftOut" || choosing ? "dashed" : last ? "primary" : "default"}
                  fontSize={text.length > 3 ? 10 : 12}
                  className={cn("font-mono font-bold tabular-nums", !(last && !choosing) && "text-foreground")}
                >
                  {choosing ? (
                    <>
                      <Spinner size={14} label="Choosing" className="bm-loader-think text-primary" />
                      <span className="sr-only">choosing songs</span>
                    </>
                  ) : (
                    <span data-part="value">{item.value}</span>
                  )}
                </HexCell>
                <span className={last && !choosing ? "text-signal-text" : undefined}>{item.label}</span>
              </li>
              {i < items.length - 1 && (
                <li aria-hidden="true" className="px-1">
                  <span className="block h-[18px] w-3 bg-primary [clip-path:polygon(0_0,50%_0,100%_50%,50%_100%,0_100%)]" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}
