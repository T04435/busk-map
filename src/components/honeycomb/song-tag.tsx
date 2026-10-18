import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";

export type SongTagKind = "your-song" | "new" | "typed" | "suggested" | "learned" | "by-your-artist" | "added";

const KINDS: Record<SongTagKind, { label: string; signal?: boolean; icon?: "check" }> = {
  "your-song": { label: "Your song", signal: true },
  new: { label: "New", signal: true },
  typed: { label: "Typed" },
  suggested: { label: "Suggested" },
  learned: { label: "Learned", icon: "check" },
  "by-your-artist": { label: "By your artist" },
  added: { label: "Added", icon: "check" },
};

/**
 * THE song tag: Your song, New, Typed, Suggested, Learned, By your artist, Added. One mono caps tag. Only "Your song" and
 * "New" carry the signal tone (orange rule and ink); the rest are neutral (rule outline).
 */
export function SongTag({
  kind,
  label,
  image,
  className,
}: {
  kind: SongTagKind;
  /** Replaces the default words (rarely: keep the kind's meaning). */
  label?: string;
  /** With "your-song": the owner's photo in a small cell before the words. */
  image?: string | null;
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
      {image ? <HexCell size={22} tone="media" image={image} /> : null}
      {k.icon ? <Icon name={k.icon} size={12} /> : null}
      <span>{label ?? k.label}</span>
    </span>
  );
}
