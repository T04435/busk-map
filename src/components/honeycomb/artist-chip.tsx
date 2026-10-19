import type { ReactNode } from "react";
import { cn } from "cn";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";
import { IconAction } from "@/components/honeycomb/icon-action";
import { Icon } from "@/components/honeycomb/icon";
import { SongTag } from "@/components/honeycomb/song-tag";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none";

/**
 * THE artist component, no box border (user feedback U01): photo (initials without one), name, where it came from, and the single action at the end. Names wrap,
 * never truncate. `state` says what it is:
 * - suggested: a dashed hex and a muted name, with Add at the end;
 * - picked: the orange hex, with Remove at the end;
 * - added: the orange hex and an "Added" tag instead of an action (a search result already in the list);
 * - static: the orange hex, no action (Because, crowd rows, tool cards, event lines, sounds-like lists).
 * `interactive={false}` makes it safe inside a combobox option, which is itself the button: no button inside, the Add icon is a drawing.
 * `size`: xs is the inline unit for "sounds like" and Because lists (small cell, the name, and a `<ScoreCell size="xs">` when
 * the score explains it), md the row, lg the featured one.
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
  href,
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
  /** false: no buttons and no link at all (inside a combobox option). */
  interactive?: boolean;
  size?: "xs" | "md" | "lg";
  /** A ScoreCell at the end (taste match, crowd fit). */
  score?: ReactNode;
  /** InfoTags under the name. */
  info?: ReactNode;
  /** The artist's Spotify page: the name becomes a plain link (new tab, no icon). Never wraps the action buttons. Ignored when not interactive. */
  href?: string | null;
  /** Body under the name (a Reason). */
  children?: ReactNode;
  className?: string;
}) {
  const sourceLabel = source === "qloo" ? "Qloo" : source === "typed" ? "Typed" : source === "spotify" ? "Spotify" : "";
  const meta = [sourceLabel, ...(tags ?? []).slice(0, 3)].filter(Boolean).join(" · ");
  const suggested = state === "suggested";
  // No box: the cell carries the state. Suggested = a dashed hex and a muted name; the rest = the orange hex.
  const cellTone = suggested ? "dashed" : "media";
  const nameCls = cn("font-bold [overflow-wrap:anywhere]", suggested && "text-muted-foreground");
  const link = interactive && href ? href : null;
  const nameEl = (cls: string) =>
    link ? (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(cls, "text-inherit underline-offset-4 hover:underline", FOCUS)}
      >
        {name}
        <span className="sr-only"> (opens Spotify)</span>
      </a>
    ) : (
      <span className={cls}>{name}</span>
    );
  if (size === "xs") {
    return (
      <span data-slot="artist-chip" data-state={state} data-size="xs" className={cn("inline-flex max-w-full items-center gap-1.5 py-0.5", className)}>
        <HexCell size={24} tone={cellTone} image={image} fontSize={9}>
          {initialsOf(name)}
        </HexCell>
        {nameEl(cn("min-w-0 text-sm leading-5", nameCls))}
        {score ? <span className="flex flex-none items-center self-stretch pl-0.5">{score}</span> : null}
      </span>
    );
  }
  const cell = size === "lg" ? 48 : 36;
  const hasAction = state === "suggested" || state === "picked";
  return (
    <div data-slot="artist-chip" data-state={state} data-size={size} className={cn("flex min-h-11 items-stretch", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pr-2.5">
        <HexCell size={cell} tone={cellTone} image={image} fontSize={size === "lg" ? 16 : 13}>
          {initialsOf(name)}
        </HexCell>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div>
            <p className="m-0 text-base leading-5 text-balance">{nameEl(nameCls)}</p>
            {meta ? <p className="m-0 font-mono text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">{meta}</p> : null}
          </div>
          {info ? <div className="flex flex-wrap gap-1.5">{info}</div> : null}
          {children}
        </div>
        {score ? <div className="flex flex-none items-center self-center">{score}</div> : null}
      </div>
      {state === "added" ? (
        <div className="flex items-center px-2.5">
          <SongTag kind="added" />
        </div>
      ) : hasAction ? (
        <div className="flex">
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
export function ArtistChipList({
  children,
  inline,
  label,
  className,
}: {
  children: React.ReactNode;
  inline?: boolean;
  /** Names the list to screen readers ("Artists you sound like"). */
  label?: string;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
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
