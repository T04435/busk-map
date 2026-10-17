import { cn } from "cn";
import { AGENT_MODEL_CREDIT } from "@/lib/agent-persona";

/** The AI disclosure tag shown wherever the agent is introduced: plain text, no logo, not a link. */
export function AiChip({ className }: { className?: string }) {
  return (
    <span
      data-slot="ai-chip"
      className={cn(
        "inline-block border-2 border-rule px-1.5 py-px font-mono text-[11px] leading-4 font-bold tracking-[0.06em] whitespace-nowrap text-foreground uppercase",
        className,
      )}
    >
      {AGENT_MODEL_CREDIT}
    </span>
  );
}
