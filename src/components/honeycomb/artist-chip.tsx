import type { ReactNode } from "react";
import { cn } from "cn";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";
import { IconAction } from "@/components/honeycomb/icon-action";
import { Icon } from "@/components/honeycomb/icon";
import { SongTag } from "@/components/honeycomb/song-tag";

/**
 * THE artist component: photo (initials without one), name, where it came from, and the single action at the end. Names wrap,
 * never truncate. `state` says what it is:
 * - suggested: a dashed border, with Add at the end;
 * - picked: a solid rule, with Remove at the end;
 * - added: a solid rule and an "Added" tag instead of an action (a search result already in the list);
 * - static: a solid rule, no action (Because, crowd rows, tool cards, event lines, sounds-like lists).
 * `interactive={false}` makes it safe inside a combobox option, which is itself the button: no button inside, the Add icon is a drawing.
 * `size`: xs is the inline unit for "sounds like" and Because lists (small cell, name only), md the row, lg the featured one.
 * Slots: `score` (ScoreCell), `info` (InfoTags), `children` (a Reason or other body under the name).
 */
export function ArtistChip({
  name,
  image,
  source,
  tags,
  state = "static",
  onAdd,
  onRemove,
  interactive = true,
  size = "md",
  score,
  info,
  children,
  className,
}: {
  name: string;
  image?: string | null;
  source?: "spotify" | "qloo" | "typed";
  /** Up to three, shown small under the name. */
  tags?: string[];
  state?: "suggested" | "picked" | "added" | "static";
  onAdd?: () => void;
  onRemove?: () => void;
  /** false: no buttons at all (inside a combobox option). */
  interactive?: boolean;
  size?: "xs" | "md" | "lg";
  /** A ScoreCell at the end (taste match, crowd fit). */
  score?: ReactNode;
  /** InfoTags under the name. */
  info?: ReactNode;
  /** Body under the name (a Reason). */
  children?: ReactNode;
  className?: string;
}) {
  const sourceLabel = source === "qloo" ? "Qloo" : source === "typed" ? "Typed" : source === "spotify" ? "Spotify" : "";
  const meta = [sourceLabel, ...(tags ?? []).slice(0, 3)].filter(Boolean).join(" · ");
  const suggested = state === "suggested";
  if (size === "xs") {
    return (
      <span
        data-slot="artist-chip"
        data-state={state}
        data-size="xs"
        className={cn("inline-flex max-w-full items-center gap-1.5 border py-0.5 pr-2 pl-1", suggested ? "border-dashed border-input" : "border-rule bg-card", className)}
      >
        <HexCell size={24} tone="media" image={image} fontSize={9}>
          {initialsOf(name)}
        </HexCell>
        <span className="min-w-0 text-sm leading-5 font-bold [overflow-wrap:anywhere]">{name}</span>
      </span>
    );
  }
  const cell = size === "lg" ? 48 : 36;
  const hasAction = state === "suggested" || state === "picked";
  return (
    <div
      data-slot="artist-chip"
      data-state={state}
      data-size={size}
      className={cn(
        "flex min-h-11 items-stretch border-2",
        suggested ? "border-dashed border-input bg-transparent" : "border-rule bg-card",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5">
        <HexCell size={cell} tone="media" image={image} fontSize={size === "lg" ? 16 : 13}>
          {initialsOf(name)}
        </HexCell>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div>
            <p className="m-0 text-base leading-5 font-bold text-balance [overflow-wrap:anywhere]">{name}</p>
            {meta ? <p className="m-0 font-mono text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">{meta}</p> : null}
          </div>
          {info ? <div className="flex flex-wrap gap-1.5">{info}</div> : null}
          {children}
        </div>
        {score ? <div className="flex flex-none items-center self-center">{score}</div> : null}
      </div>
      {state === "added" ? (
        <div className="flex items-center border-l-2 border-rule px-2.5">
          <SongTag kind="added" />
        </div>
      ) : hasAction ? (
        <div className="flex border-l-2 border-rule">
          {interactive ? (
            suggested ? (
              <IconAction icon="plus" label={`Add ${name}`} onClick={onAdd} className="h-full min-h-11" />
            ) : (
              <IconAction icon="x" label={`Remove ${name}`} onClick={onRemove} className="h-full min-h-11" />
            )
          ) : (
            <span aria-hidden="true" className="inline-flex size-11 items-center justify-center">
              <Icon name={suggested ? "plus" : "x"} size={18} />
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** The grid ArtistChips sit in: as many columns as fit, never narrower than 260px (or the container). `inline` is the wrapping row for xs chips. */
export function ArtistChipList({ children, inline, className }: { children: React.ReactNode; inline?: boolean; className?: string }) {
  return (
    <ul
      className={cn(
        "m-0 list-none p-0",
        inline ? "flex flex-wrap gap-1.5" : "grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-2",
        className,
      )}
    >
      {children}
    </ul>
  );
}
