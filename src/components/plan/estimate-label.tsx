import type { ReactNode } from "react";
import { cn } from "cn";

const TAG = "font-mono text-[11px] leading-[14px] font-bold tracking-[0.02em] text-estimate";

/**
 * Marks a number as an estimate (architecture: honest UI): a dotted `estimate` underline on the value and one short "est." tag.
 * The word is the signal; the colour only helps. Never round an estimate to look more precise than it is.
 *
 * - `<EstimateLabel>1,200</EstimateLabel>` wraps a value.
 * - `<EstimateLabel />` is the tag alone, after a sentence that carries the value.
 */
export function EstimateLabel({ children, tag = "est.", className }: { children?: ReactNode; tag?: string; className?: string }) {
  const hasValue = children !== undefined && children !== null && children !== false;
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      {hasValue ? (
        <>
          <span className="underline decoration-estimate decoration-2 underline-offset-4 [text-decoration-style:dotted]">{children}</span>
          <span className={TAG}>{tag}</span>
        </>
      ) : (
        <span className={cn(TAG, "underline decoration-estimate decoration-2 underline-offset-4 [text-decoration-style:dotted]")}>{tag}</span>
      )}
    </span>
  );
}
