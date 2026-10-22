import { Icon } from "@/components/honeycomb/icon";
import { Badge } from "@/components/ui/badge";

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
    <Badge variant="song" data-slot="song-tag" data-kind={kind} className={className}>
      {k.icon ? <Icon name={k.icon} size={12} /> : null}
      <span>{label ?? k.label}</span>
    </Badge>
  );
}
