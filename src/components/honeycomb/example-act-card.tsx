import type { ReactNode } from "react";
import Link from "next/link";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";

/**
 * One of the example acts on the landing. An outline hex with the act's monogram, the act in display caps with its day and
 * hours, "Sounds like …", "Plays …", then the action as an orange underlined link. The link is an input preset that starts a
 * fresh run (so no prefetch); it is stretched over the whole card, so the card is still one tap target, and keeps its own
 * focus ring and a 44px-tall hit area. Hover lifts the card with an orange offset.
 */
export function ExampleActCard({
  name,
  monogram,
  when,
  blurb,
  soundsLike,
  plays,
  href,
  action = "Watch Busk Map plan this act",
}: {
  name: string;
  /** The two letters in the hex (the board's, e.g. "SX"); falls back to the initials of the name. */
  monogram?: string;
  /** Day and hours under the name, e.g. "Saturday · 6–9 pm". */
  when?: string;
  blurb?: ReactNode;
  soundsLike?: string;
  /** A few songs the act plays, after "Plays". */
  plays?: string;
  href: string;
  action?: string;
}) {
  return (
    <div
      data-slot="example-act-card"
      className="group/example relative flex h-full flex-col gap-3 border-2 border-rule bg-card p-4 text-foreground transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out) focus-within:-translate-x-0.5 focus-within:-translate-y-0.5 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--primary)] motion-reduce:transition-none"
    >
      <span className="flex items-center gap-3">
        <HexCell size={44} tone="default">
          {monogram ?? initialsOf(name)}
        </HexCell>
        <span className="min-w-0 flex-1">
          <b className="block font-display text-[22px] leading-[1.05] font-extrabold uppercase">{name}</b>
          {when ? <span className="block font-mono text-xs leading-4 font-medium text-muted-foreground">{when}</span> : null}
        </span>
      </span>
      {blurb ? <span className="text-sm leading-5 text-muted-foreground">{blurb}</span> : null}
      {soundsLike ? (
        <span className="text-sm leading-5">
          <b>Sounds like</b> {soundsLike}
        </span>
      ) : null}
      {plays ? (
        <span className="text-sm leading-5 text-muted-foreground">
          <b className="text-foreground">Plays</b> {plays}
        </span>
      ) : null}
      <span className="mt-auto border-t border-border pt-1">
        <Link
          prefetch={false}
          href={href}
          className="inline-flex min-h-11 items-center text-[15px] font-bold text-signal-text underline underline-offset-3 hover:decoration-2 after:absolute after:inset-0 after:content-['']"
        >
          {action} <span aria-hidden="true">&nbsp;→</span>
        </Link>
      </span>
    </div>
  );
}
