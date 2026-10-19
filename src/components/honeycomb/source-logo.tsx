import { cn } from "cn";
import type { MentionSource } from "@/lib/mention";

const NAMES: Record<MentionSource, string> = { spotify: "Spotify", lastfm: "Last.fm", qloo: "Qloo" };

/**
 * A data source as its partner's icon-only mark at text size, the name only in the accessible label (U07, U17: no wordmarks,
 * no lockups). Spotify's symbol (cut from the official full logo) swaps black and white by theme with CSS; Last.fm is its red "as" app icon; Qloo is its favicon mark (ink or white ring, the
 * purple tail), swapped by theme. Sources: design-handoff/logos/partners/SOURCES.md. `height` is the logo's px height (default 14).
 */
export function SourceLogo({ source, height = 14, className }: { source: MentionSource; height?: number; className?: string }) {
  const name = NAMES[source];
  const img = "block w-auto max-w-none";
  return (
    <span data-slot="source-logo" data-source={source} role="img" aria-label={name} className={cn("inline-flex items-center", className)}>
      {source === "spotify" ? (
        <>
          {/* eslint-disable @next/next/no-img-element -- static partner SVGs, decorative inside a labelled wrapper */}
          <img src="/partners/spotify-icon-black.svg" alt="" width={height} height={height} style={{ height, width: height }} className={cn(img, "dark:hidden")} />
          <img src="/partners/spotify-icon-white.svg" alt="" width={height} height={height} style={{ height, width: height }} className={cn(img, "hidden dark:block")} />
        </>
      ) : source === "lastfm" ? (
        <img src="/partners/lastfm-icon.png" alt="" width={height} height={height} style={{ height, width: height }} className={img} />
      ) : (
        <>
          <img src="/partners/qloo-icon-ink.svg" alt="" width={height} height={height} style={{ height, width: height }} className={cn(img, "dark:hidden")} />
          <img src="/partners/qloo-icon-white.svg" alt="" width={height} height={height} style={{ height, width: height }} className={cn(img, "hidden dark:block")} />
        </>
      )}
    </span>
  );
}
