import { cn } from "cn";
import { Icon } from "@/components/honeycomb/icon";

export type SongTagKind = "new" | "typed" | "suggested" | "learned" | "by-your-artist" | "added";

const KINDS: Record<SongTagKind, { label: string; signal?: boolean; icon?: "check" }> = {
  new: { label: "New", signal: true },
  typed: { label: "Typed" },
  suggested: { label: "Suggested" },
  learned: { label: "Learned", icon: "check" },
  "by-your-artist": { label: "By your artist" },
  added: { label: "Added", icon: "check" },
};

/**
 * THE song tag: New, Typed, Suggested, Learned, By your artist, Added. One mono caps tag. Only "New" carries the signal tone (orange rule and ink); the rest are neutral (rule outline).
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
        k.signal ? "border-primary text-signal-text" : "border-rule text-foreground",
        className,
      )}
    >
      {k.icon ? <Icon name={k.icon} size={12} /> : null}
      <span>{label ?? k.label}</span>
    </span>
  );
}
