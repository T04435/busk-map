import { cn } from "cn";
import type { MentionSource } from "@/lib/mention";

const NAMES: Record<MentionSource, string> = { spotify: "Spotify", lastfm: "Last.fm", qloo: "Qloo" };

/**
 * A data source as its partner logo, the name only in the accessible label (user feedback U07). Spotify swaps its black and
 * white lockups by theme with CSS; Last.fm has one file. Qloo has no logo file in public/partners, so it stays its name in
 * Qloo purple (the one place the purple is allowed: Qloo is named). `height` is the logo's px height (default 14).
 */
export function SourceLogo({ source, height = 14, className }: { source: MentionSource; height?: number; className?: string }) {
  const name = NAMES[source];
  const img = "block w-auto max-w-none";
  return (
    <span data-slot="source-logo" data-source={source} role="img" aria-label={name} className={cn("inline-flex items-center", className)}>
      {source === "spotify" ? (
        <>
          {/* eslint-disable @next/next/no-img-element -- static partner SVGs, decorative inside a labelled wrapper */}
          <img src="/partners/spotify-full-logo-black.svg" alt="" height={height} style={{ height }} className={cn(img, "dark:hidden")} />
          <img src="/partners/spotify-full-logo-white.svg" alt="" height={height} style={{ height }} className={cn(img, "hidden dark:block")} />
        </>
      ) : source === "lastfm" ? (
        <img src="/partners/lastfm-logo.svg" alt="" height={height} style={{ height }} className={img} />
      ) : (
        <span aria-hidden="true" className="font-display font-extrabold text-qloo" style={{ fontSize: Math.round(height * 1.1), lineHeight: 1 }}>
          Qloo
        </span>
      )}
    </span>
  );
}
