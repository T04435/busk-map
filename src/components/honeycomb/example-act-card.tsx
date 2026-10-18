import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/honeycomb/icon";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";
import { ArtistChip, ArtistChipList } from "@/components/honeycomb/artist-chip";

/**
 * One of the example acts on the landing: the whole card is the link, an input preset that starts a fresh run (so no
 * prefetch). Initials in an orange cell, the act in display caps with its day and hours, "Sounds like" (xs ArtistChips), "Plays …", then the action.
 * Hover lifts it with an orange offset.
 */
export function ExampleActCard({
  name,
  when,
  blurb,
  soundsLike,
  plays,
  href,
  action = "Watch Busk Map plan this act",
}: {
  name: string;
  /** Day and hours under the name, e.g. "Saturday · 6–9 pm". */
  when?: string;
  blurb?: ReactNode;
  /** Artists the act sounds like, drawn as xs ArtistChips. */
  soundsLike?: string[];
  /** A few songs the act plays, after "Plays". */
  plays?: string;
  href: string;
  action?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      data-slot="example-act-card"
      className="group/example flex h-full min-h-tap flex-col gap-3 border-2 border-rule bg-card p-4 text-foreground no-underline transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out) hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--primary)] motion-reduce:transition-none"
    >
      <span className="flex items-center gap-3">
        <HexCell size={44} tone="primary">
          {initialsOf(name)}
        </HexCell>
        <span className="min-w-0 flex-1">
          <b className="block font-display text-[22px] leading-[1.05] font-extrabold uppercase">{name}</b>
          {when ? <span className="block font-mono text-xs leading-4 font-medium text-muted-foreground">{when}</span> : null}
        </span>
      </span>
      {blurb ? <span className="text-sm leading-5 text-muted-foreground">{blurb}</span> : null}
      {soundsLike?.length ? (
        <div className="flex flex-col gap-1.5 text-sm leading-5">
          <b>Sounds like</b>
          <ArtistChipList inline>
            {soundsLike.map((a) => (
              <li key={a}>
                <ArtistChip size="xs" name={a} interactive={false} />
              </li>
            ))}
          </ArtistChipList>
        </div>
      ) : null}
      {plays ? (
        <span className="text-sm leading-5 text-muted-foreground">
          <b className="text-foreground">Plays</b> {plays}
        </span>
      ) : null}
      <span className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[15px] font-bold">
        {action}
        <Icon name="arrow-right" size={20} />
      </span>
    </Link>
  );
}
