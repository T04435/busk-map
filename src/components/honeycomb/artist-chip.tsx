import { cn } from "cn";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";
import { IconAction } from "@/components/honeycomb/icon-action";

/**
 * One unit per artist: photo or initials, name, where it came from, and the single action at the end (add when it is
 * only suggested, remove when picked). A suggested artist has a dashed border; a picked one a solid rule. Names wrap, never truncate.
 */
export function ArtistChip({
  name,
  image,
  source,
  tags,
  state,
  onAdd,
  onRemove,
  size = "md",
  className,
}: {
  name: string;
  image?: string | null;
  source?: "spotify" | "qloo" | "typed";
  /** Up to three, shown small under the name. */
  tags?: string[];
  state: "suggested" | "picked";
  onAdd?: () => void;
  onRemove?: () => void;
  size?: "md" | "lg";
  className?: string;
}) {
  const sourceLabel = source === "qloo" ? "Qloo" : source === "typed" ? "Typed" : "";
  const meta = [sourceLabel, ...(tags ?? []).slice(0, 3)].filter(Boolean).join(" · ");
  const suggested = state === "suggested";
  return (
    <div
      data-slot="artist-chip"
      data-state={state}
      className={cn(
        "flex min-h-11 items-stretch border-2",
        suggested ? "border-dashed border-input bg-transparent" : "border-rule bg-card",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5">
        <HexCell size={size === "lg" ? 48 : 36} tone="media" image={image} fontSize={size === "lg" ? 16 : 13}>
          {initialsOf(name)}
        </HexCell>
        <div className="min-w-0">
          <p className="m-0 text-base leading-5 font-bold text-balance [overflow-wrap:anywhere]">{name}</p>
          {meta ? (
            <p className="m-0 font-mono text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">{meta}</p>
          ) : null}
        </div>
      </div>
      <div className="flex border-l-2 border-rule">
        {suggested ? (
          <IconAction icon="plus" label={`Add ${name}`} onClick={onAdd} className="h-full min-h-11" />
        ) : (
          <IconAction icon="x" label={`Remove ${name}`} onClick={onRemove} className="h-full min-h-11" />
        )}
      </div>
    </div>
  );
}

/** The grid ArtistChips sit in: as many columns as fit, never narrower than 220px (or the container). */
export function ArtistChipList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <ul
      className={cn("m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-2 p-0", className)}
    >
      {children}
    </ul>
  );
}
