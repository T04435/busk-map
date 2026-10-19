import { cn } from "cn";
import { Icon } from "@/components/honeycomb/icon";

export type SongTagKind = "typed" | "suggested" | "learned" | "by-your-artist" | "added";

const KINDS: Record<SongTagKind, { label: string; icon?: "check" }> = {
  typed: { label: "Typed" },
  suggested: { label: "Suggested" },
  learned: { label: "Learned", icon: "check" },
  "by-your-artist": { label: "By your artist" },
  added: { label: "Added", icon: "check" },
};

/**
 * THE song tag: Typed, Suggested, Learned, By your artist, Added. One mono caps tag on a neutral rule outline (no NEW tag: U20).
 */
export function SongTag({
  kind,
  label,
  className,
}: {
  kind: SongTagKind;
  /** Replaces the default words (rarely: keep the kind's meaning). */
  label?: string;
  className?: string;
}) {
  const k = KINDS[kind];
  return (
    <span
      data-slot="song-tag"
      data-kind={kind}
      className={cn(
        "inline-flex items-center gap-1.5 border-2 bg-card px-1.5 py-0.5 font-mono text-[11px] leading-4 font-bold tracking-[0.06em] uppercase",
        "border-rule text-foreground",
        className,
      )}
    >
      {k.icon ? <Icon name={k.icon} size={12} /> : null}
      <span>{label ?? k.label}</span>
    </span>
  );
}
