import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";

/**
 * One of the example acts on the landing: the whole card is the link, an input preset that starts a fresh run (so no
 * prefetch). Initials in an orange cell, the act in display caps, the blurb, "Sounds like …", then the action.
 * Hover lifts it with an orange offset.
 */
export function ExampleActCard({ name, blurb, soundsLike, href, action = "Watch Busk Map plan this act" }: { name: string; blurb?: ReactNode; soundsLike?: string; href: string; action?: string }) {
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
        <span className="min-w-0 flex-1 font-display text-[22px] leading-[1.05] font-extrabold uppercase">{name}</span>
      </span>
      {blurb ? <span className="text-sm leading-5 text-muted-foreground">{blurb}</span> : null}
      {soundsLike ? <span className="font-mono text-xs leading-4 text-muted-foreground">Sounds like {soundsLike}</span> : null}
      <span className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[15px] font-bold">
        {action}
        <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
      </span>
    </Link>
  );
}
