import type { ReactNode } from "react";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { PercentCell } from "@/components/honeycomb/percent-cell";

const tagClass =
  "inline-flex items-center gap-1.5 border-2 border-rule bg-card px-1.5 py-0.5 font-mono text-[11px] leading-4 font-bold tracking-[0.06em] uppercase";

/** m:ss from milliseconds. */
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * THE song component: every place a song shows (repertoire, search results, picked songs, suggested set, songs to
 * learn, learn-run results) uses this row. A cover cell, the title and a meta line, an optional score cell, a body
 * slot for reasons and an actions slot. Titles and artists wrap, never truncate. On a narrow row the actions wrap
 * under the text instead of squeezing it.
 */
export function SongRow({
  title,
  artist,
  year,
  durationMs,
  album,
  image,
  size = "md",
  index,
  own,
  ownerImage,
  badges,
  score,
  scoreLabel,
  children,
  actions,
  href,
  muted,
  as = "li",
  className,
}: {
  title: string;
  artist: string;
  year?: number | null;
  durationMs?: number | null;
  album?: string | null;
  /** Album art. Falls back to the music icon. */
  image?: string | null;
  /** md = 44px cover; sm = 32px for dense lists such as search results. */
  size?: "md" | "sm";
  /** Two-digit position before the cover (setlists). */
  index?: number;
  /** Shows the "Your song" tag. */
  own?: boolean;
  /** With `own`: the owner's photo in a small cell next to the tag. */
  ownerImage?: string;
  /** Extra tags on the meta line ("Suggested", "New this run"). */
  badges?: ReactNode;
  score?: number | null;
  scoreLabel?: string;
  /** Body under the title and meta, aligned to the text column. */
  children?: ReactNode;
  /** Right-aligned IconAction buttons or small buttons. */
  actions?: ReactNode;
  /** A Spotify track link: the title becomes a link that opens in a new tab. */
  href?: string;
  /** Dimmed, e.g. dismissed. */
  muted?: boolean;
  as?: "li" | "div";
  className?: string;
}) {
  const Tag = as;
  const meta = [artist, year ?? null, album || null].filter((p) => p != null && p !== "").join(" · ");
  const hasScore = score != null;
  const hasRight = hasScore || Boolean(actions);
  const cover = size === "sm" ? 32 : 44;
  return (
    <Tag
      data-slot="song-row"
      className={cn("@container py-3", muted && "opacity-60", className)}
    >
      <div
        className={cn(
          "grid items-start gap-x-3",
          index != null ? "grid-cols-[auto_auto_minmax(0,1fr)]" : "grid-cols-[auto_minmax(0,1fr)]",
          hasRight && (index != null ? "@min-[420px]:grid-cols-[auto_auto_minmax(0,1fr)_auto]" : "@min-[420px]:grid-cols-[auto_minmax(0,1fr)_auto]"),
        )}
      >
        {index != null ? (
          <span className="pt-0.5 font-mono text-sm leading-6 font-bold tabular-nums text-muted-foreground" aria-hidden="true">
            {String(index).padStart(2, "0")}
          </span>
        ) : null}
        <HexCell size={cover} tone="media" image={image} fontSize={Math.round(cover * 0.4)}>
          <Icon name="music" size={Math.round(cover * 0.45)} />
        </HexCell>
        <div className="min-w-0">
          <p className="m-0 text-base leading-6 font-bold text-balance [overflow-wrap:anywhere]">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none"
              >
                {title}
                <span className="sr-only"> (opens Spotify)</span>
                <Icon name="external" size={14} className="ml-1" />
              </a>
            ) : (
              title
            )}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-5 text-muted-foreground">
            {meta ? <span className="[overflow-wrap:anywhere]">{meta}</span> : null}
            {own ? (
              <span className={tagClass}>
                {ownerImage ? <HexCell size={22} tone="media" image={ownerImage} /> : null}
                <span>Your song</span>
              </span>
            ) : null}
            {badges}
            {durationMs != null ? (
              <span className="ml-auto font-mono text-xs tabular-nums">{formatDuration(durationMs)}</span>
            ) : null}
          </div>
          {children ? <div className="mt-2 text-sm">{children}</div> : null}
        </div>
        {hasRight ? (
          <div
            className={cn(
              "flex items-center gap-1",
              // Narrow: the score and actions drop under the text column.
              "col-start-2 mt-2 @min-[420px]:col-start-auto @min-[420px]:mt-0",
              index != null && "col-start-3 @min-[420px]:col-start-auto",
            )}
          >
            {hasScore ? <PercentCell value={score} size={40} label={scoreLabel} /> : null}
            {actions}
          </div>
        ) : null}
      </div>
    </Tag>
  );
}
