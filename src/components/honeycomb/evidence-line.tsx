import type { ReactNode } from "react";
import { cn } from "cn";

/** Where a block's facts come from: the data call behind it, under the block. A mono "EVIDENCE" tag, then one plain sentence. */
export function EvidenceLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("m-0 flex items-baseline gap-2 text-[13px] leading-[18px] text-muted-foreground", className)}>
      <span className="flex-none border border-input px-[5px] font-mono text-[10px] leading-4 font-bold tracking-[0.08em] uppercase">Evidence</span>
      <span>{children}</span>
    </p>
  );
}
