import { cn } from "cn";
import type { MentionSource } from "@/lib/mention";

const NAMES: Record<MentionSource, string> = { spotify: "Spotify", lastfm: "Last.fm", qloo: "Qloo" };

/**
 * The neutral data-source glyph (three stacked slabs, 24-unit box): Busk Map's own drawing, not any partner's mark. It stands
 * beside the plain word "Qloo" wherever a Qloo-sourced item is marked, and in the centre cell of the Hive mark on a Qloo step.
 */
export const DATA_GLYPH = (
  <>
    <rect x="3" y="3" width="18" height="5" fill="currentColor" />
    <rect x="3" y="9.5" width="18" height="5" fill="currentColor" />
    <rect x="3" y="16" width="18" height="5" fill="currentColor" />
  </>
);

/**
 * A data source at text size. Spotify and Last.fm are their icon-only marks (U07, U17: no wordmarks, no lockups), the name in the
 * accessible label: Spotify's symbol (cut from the official full logo) swaps black and white by theme with CSS; Last.fm is its red
 * "as" app icon (sources: design-handoff/logos/partners/SOURCES.md). Qloo is never shown as a logo: it is the neutral data glyph
 * plus the plain word "Qloo", in the neutral slate token. `height` is the mark's px height (default 14).
 */
export function SourceLogo({ source, height = 14, className }: { source: MentionSource; height?: number; className?: string }) {
  const name = NAMES[source];
  const img = "block w-auto max-w-none";
  if (source === "qloo") {
    return (
      <span data-slot="source-logo" data-source={source} className={cn("inline-flex items-center gap-1 align-middle font-mono leading-none font-bold whitespace-nowrap text-slate", className)} style={{ fontSize: Math.max(11, Math.round(height * 0.86)) }}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width={Math.round(height * 0.86)} height={Math.round(height * 0.86)} className="block flex-none">
          {DATA_GLYPH}
        </svg>
        {name}
      </span>
    );
  }
  return (
    <span data-slot="source-logo" data-source={source} role="img" aria-label={name} className={cn("inline-flex items-center", className)}>
      {source === "spotify" ? (
        <>
          {/* eslint-disable @next/next/no-img-element -- static partner SVGs, decorative inside a labelled wrapper */}
          <img src="/partners/spotify-icon-black.svg" alt="" width={height} height={height} style={{ height, width: height }} className={cn(img, "dark:hidden")} />
          <img src="/partners/spotify-icon-white.svg" alt="" width={height} height={height} style={{ height, width: height }} className={cn(img, "hidden dark:block")} />
        </>
      ) : (
        <img src="/partners/lastfm-icon.png" alt="" width={height} height={height} style={{ height, width: height }} className={img} />
      )}
    </span>
  );
}
