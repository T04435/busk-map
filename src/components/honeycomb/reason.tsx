import { cn } from "cn";
import { RichText as RichTextView } from "@/components/honeycomb/mention";
import type { RichText } from "@/lib/mention";

/**
 * THE why line: the reason in plain words, with every artist, song or source it names drawn inline as a Mention (a small hex
 * photo plus the name in brand orange). `text` is a string or a RichText array (strings and mentions). No chip row under it.
 * Never truncated. A score never sits in prose: an artist mention may carry its own xs `score`; otherwise it is the row's ScoreCell.
 */
export function Reason({ text, className }: { text: string | RichText; className?: string }) {
  return (
    <p data-slot="reason" className={cn("m-0 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]", className)}>
      <RichTextView text={text} />
    </p>
  );
}
