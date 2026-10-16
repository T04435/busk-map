import type { ReactNode } from "react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TAG = "font-mono text-[11px] leading-[14px] font-bold tracking-[0.02em] text-estimate";

/**
 * Marks a number as an estimate (architecture: honest UI): a dotted `estimate` underline on the value and a small
 * "est." tag, with the basis on hover or focus. The word is the signal; the colour only helps. Never round an estimate
 * to look more precise than it is.
 *
 * - `<EstimateLabel>1,200</EstimateLabel>` wraps a value.
 * - `<EstimateLabel />` or `<EstimateLabel tag="Estimated end" />` is the tag alone, after a sentence that carries the value.
 * - `basis` (one sentence: what it was estimated from) makes it focusable with a tooltip.
 */
export function EstimateLabel({
  children,
  tag,
  basis,
  className,
}: {
  children?: ReactNode;
  tag?: string;
  basis?: string;
  className?: string;
}) {
  const hasValue = children !== undefined && children !== null && children !== false;
  const content = hasValue ? (
    <>
      <span className="underline decoration-estimate decoration-2 underline-offset-4 [text-decoration-style:dotted]">{children}</span>
      <span className={TAG}>{tag ?? "est."}</span>
    </>
  ) : (
    <span className={cn(TAG, "underline decoration-estimate decoration-2 underline-offset-4 [text-decoration-style:dotted]")}>{tag ?? "Estimate"}</span>
  );
  if (!basis) return <span className={cn("inline-flex items-baseline gap-1", className)}>{content}</span>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={cn("inline-flex cursor-help items-baseline gap-1 rounded-none border-0 bg-transparent p-0 font-[inherit]", className)}>
            {content}
          </button>
        </TooltipTrigger>
        <TooltipContent>{basis}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
