import { Badge } from "@/components/ui/badge";
import type { LevelWord } from "@/lib/signal-level";

const VARIANT = { "Live data": "neutral", Estimate: "estimate", "Not checked": "unchecked" } as const;

/** A signal's level in plain words (lib/signal-level.ts): "Live data", "Estimate" or "Not checked". Nothing when there is no word. */
export function LevelBadge({ word, className }: { word: LevelWord | null | undefined; className?: string }) {
  if (!word) return null;
  return (
    <Badge variant={VARIANT[word]} data-testid="level-badge" data-level={word} className={className}>
      {word}
    </Badge>
  );
}
