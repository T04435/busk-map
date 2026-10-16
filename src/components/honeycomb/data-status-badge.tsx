import { cn } from "cn";

/** The app's adapter modes (live, synthetic, fallback) map onto the design's words. */
export type DataStatus = "live" | "cached" | "test" | "estimated" | "unavailable" | "synthetic" | "fallback";

const WORDS: Record<"live" | "cached" | "test" | "estimated" | "unavailable", string> = {
  live: "Live",
  cached: "Cached",
  test: "Test data",
  estimated: "Estimated",
  unavailable: "Unavailable",
};
const ALIAS = { synthetic: "test", fallback: "unavailable" } as const;

/**
 * Where a number came from, as a dot and words: live, cached, test data, estimated, unavailable. The dot differs in
 * shape and fill for each status, and the word is always there, so it never relies on colour.
 */
export function DataStatusBadge({ status = "live", source, label, reason, className }: { status?: DataStatus; source?: string; label?: string; reason?: string; className?: string }) {
  const s = status in ALIAS ? ALIAS[status as keyof typeof ALIAS] : (status as keyof typeof WORDS);
  const dot: Record<keyof typeof WORDS, string> = {
    live: "rounded-full bg-pitch-legal",
    cached: "rounded-full shadow-[inset_0_0_0_2px_var(--pitch-legal)]",
    test: "rounded-full bg-[repeating-linear-gradient(45deg,var(--estimate)_0_2px,transparent_2px_4px)] shadow-[inset_0_0_0_1.5px_var(--estimate)]",
    estimated: "size-2 rotate-45 shadow-[inset_0_0_0_2px_var(--estimate)]",
    unavailable: "bg-destructive",
  };
  return (
    <span data-slot="data-status" data-status={s} className={cn("inline-flex items-center gap-1.5 text-[13px] leading-[18px] font-bold", className)}>
      <span aria-hidden="true" className={cn("size-2.5 shrink-0", dot[s])} />
      {source ? <span>{source}:</span> : null}
      <span>{label ?? WORDS[s]}</span>
      {reason ? <span className="font-normal text-muted-foreground">· {reason}</span> : null}
    </span>
  );
}
