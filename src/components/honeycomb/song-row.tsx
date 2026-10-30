import type { ReactNode } from "react";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { Mention } from "@/components/honeycomb/mention";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import { NotOnQTag } from "@/components/honeycomb/info-tag";
import type { FilledBy } from "@/lib/notonq";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import type { MentionSource } from "@/lib/mention";

/** m:ss from milliseconds. */
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * THE song component: every place a song shows (repertoire, search results, picked songs, suggested set, songs to
 * learn, learn-run results, setlists, tool cards) uses this row. A cover cell, the title and a meta line, then slots
 * that take only the unified parts: `tags` (SongTag), `info` (InfoTag), `reason` (Reason), `score` (ScoreCell), `actions`
 * (SongActions). Duration lives here only. Titles and artists wrap, never truncate. Built on shadcn Item.
 * - size sm|md: 32 or 44px cover. `compact`: the agent tool cards (28px cover, small type, tight rows).
 * - `index` is the set position (setlists), two digits before the cover.
 * - `interactive={false}`: a combobox option. Nothing focusable inside (no link, no actions; the option is the control),
 *   rendered as a div; show the Added state with an "added" SongTag in `tags`.
 */
export function SongRow({
  title,
  artist,
  year,
  durationMs,
  album,
  image,
  artistImage,
  artists,
  artistHref,
  source,
  size = "md",
  compact,
  interactive = true,
  index,
  tags,
  info,
  filledBy,
  reason,
  score,
  scoreLabel,
  children,
  actions,
  href,
  muted,
  as,
  className,
}: {
  title: string;
  artist: string;
  year?: number | null;
  durationMs?: number | null;
  album?: string | null;
  /** The cover: the track's own image or its album art. Falls back to `artistImage`, then the music icon. */
  image?: string | null;
  /** The artist's photo: shown as the artist's small hex in the meta line, and the cover when `image` is missing. */
  artistImage?: string | null;
  /** Several artists, each an inline mention (overrides `artist`). `href`: the artist on Spotify. */
  /** The artist on Spotify: their mention becomes a link (U06). */
  artistHref?: string | null;
  artists?: { name: string; image?: string | null; href?: string | null }[];
  /** The data source as its logo (Spotify, Last.fm), after the meta. */
  source?: MentionSource;
  /** md = 44px cover; sm = 32px for dense lists such as search results. */
  size?: "md" | "sm";
  /** The agent tool cards: a 28px cover, small type, tight rows. */
  compact?: boolean;
  /** false: no link and no actions, for use inside a combobox option. */
  interactive?: boolean;
  /** Two-digit set position before the cover (setlists). */
  index?: number;
  /** SongTags on the meta line (Suggested, New, Added). */
  tags?: ReactNode;
  /** InfoTags under the meta line (Rising +x, Builds on X). */
  info?: ReactNode;
  /** "notonq": the song's artist was filled in by NotOnQ (Qloo lacks it): labelled "Filled by NotOnQ" with the InfoTags. */
  filledBy?: FilledBy;
  /** A Reason: why this song, with the artists behind it. */
  reason?: ReactNode;
  /** 0-100: shown as a ScoreCell at the right. */
  score?: number | null;
  scoreLabel?: string;
  /** Anything else under the title and meta, aligned to the text column. */
  children?: ReactNode;
  /** SongActions, at the right. Ignored when not interactive. */
  actions?: ReactNode;
  /** A Spotify track link: the title becomes a link that opens in a new tab. */
  href?: string;
  /** Dimmed, e.g. dismissed. */
  muted?: boolean;
  as?: "li" | "div";
  className?: string;
}) {
  const Tag = as ?? (interactive ? "li" : "div");
  const meta = [year ?? null, album || null].filter((p) => p != null && p !== "").join(" · ");
  const hasScore = score != null;
  const showActions = interactive && Boolean(actions);
  const hasRight = hasScore || showActions;
  const who: { name: string; image?: string | null; href?: string | null }[] = artists && artists.length > 0 ? artists : artist ? [{ name: artist, image: artistImage, href: artistHref }] : [];
  const coverImage = image || artistImage || null;
  const cover = compact ? 28 : size === "sm" ? 32 : 44;
  return (
    <Tag
      data-slot="song-row"
      className={cn("@container", compact ? "py-1.5" : "py-3", muted && "opacity-60", className)}
    >
      <Item
        className={cn(
          "grid items-start gap-x-3 gap-y-0",
          index != null
            ? hasRight
              ? "grid-cols-[auto_auto_minmax(0,1fr)_auto]"
              : "grid-cols-[auto_auto_minmax(0,1fr)]"
            : hasRight
              ? "grid-cols-[auto_minmax(0,1fr)_auto]"
              : "grid-cols-[auto_minmax(0,1fr)]",
        )}
      >
        {index != null ? (
          <span className="pt-0.5 font-mono text-sm leading-6 font-bold tabular-nums text-muted-foreground" aria-hidden="true">
            {String(index).padStart(2, "0")}
          </span>
        ) : null}
        <ItemMedia>
          <HexCell size={cover} tone="media" image={coverImage} fontSize={Math.round(cover * 0.4)}>
            <Icon name="music" size={Math.round(cover * 0.45)} />
          </HexCell>
        </ItemMedia>
        <ItemContent className="block">
          <ItemTitle asChild className={cn("m-0 font-bold text-balance [overflow-wrap:anywhere]", compact ? "text-sm leading-5" : "text-base leading-6")}>
            <p>
              {href && interactive ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  // A block of its own, one line high: the title link is a 24px target (WCAG 2.2 target size) even with the artist link right under it.
                  className="inline-block max-w-full min-h-6 text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none"
                >
                  {title}
                  <span className="sr-only"> (opens Spotify)</span>
                </a>
              ) : (
                title
              )}
            </p>
          </ItemTitle>
          <ItemDescription asChild className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-5 text-muted-foreground", compact ? "text-xs" : "text-sm")}>
            <div>
              {who.length > 0 ? (
                // The artists as inline mentions (U14): hex photo plus the name in brand orange, the same as in a reason.
                <span data-slot="song-artists" className="[overflow-wrap:anywhere]">
                  {who.map((a, i) => (
                    <span key={`${a.name}-${i}`}>
                      {i > 0 ? ", " : null}
                      <Mention mention={{ kind: "artist", name: a.name, image: a.image, href: interactive ? a.href : null }} />
                    </span>
                  ))}
                </span>
              ) : null}
              {meta ? <span className="[overflow-wrap:anywhere]">{who.length > 0 ? `· ${meta}` : meta}</span> : null}
              {source ? <SourceLogo source={source} height={compact ? 12 : 14} /> : null}
              {tags}
              {durationMs != null ? (
                <span className="ml-auto font-mono text-xs tabular-nums">{formatDuration(durationMs)}</span>
              ) : null}
            </div>
          </ItemDescription>
          {info || filledBy === "notonq" ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {filledBy === "notonq" ? <NotOnQTag /> : null}
              {info}
            </div>
          ) : null}
          {reason ? <div className="mt-2">{reason}</div> : null}
          {children ? <div className="mt-2 text-sm">{children}</div> : null}
        </ItemContent>
        {hasRight ? (
          // The score and an icon or two stay at the right on every width; more than two wrap under the text on a narrow row.
          <ItemActions
            className={cn(
              "-my-1 flex items-center gap-1",
              // Three or more actions would squeeze the text on a phone: they drop under it instead.
              index != null
                ? "@max-[24rem]:has-[[data-many]]:col-span-2 @max-[24rem]:has-[[data-many]]:col-start-3 @max-[24rem]:has-[[data-many]]:row-start-2 @max-[24rem]:has-[[data-many]]:mt-1"
                : "@max-[24rem]:has-[[data-many]]:col-span-2 @max-[24rem]:has-[[data-many]]:col-start-2 @max-[24rem]:has-[[data-many]]:row-start-2 @max-[24rem]:has-[[data-many]]:mt-1",
            )}
          >
            {hasScore ? <ScoreCell value={score} size={compact || size === "sm" ? "sm" : "md"} label={scoreLabel} /> : null}
            {showActions ? actions : null}
          </ItemActions>
        ) : null}
      </Item>
    </Tag>
  );
}
