import { cn } from "cn";
import { HiveMark } from "@/components/honeycomb/hive-mark";
import { AGENT_NAME } from "@/lib/agent-persona";

/** The agent's tag before its own notes on a step card: the full mark (14) and its name in mono caps. Replaces the "CLAUDE" tag. */
export function AgentTag({ name = AGENT_NAME, className }: { name?: string; className?: string }) {
  return (
    <span data-slot="agent-tag" className={cn("mr-1.5 inline-flex items-center gap-1 align-[-2px] whitespace-nowrap", className)}>
      <HiveMark size={14} />
      <span className="font-mono text-[11px] leading-4 font-bold tracking-[0.08em] text-signal-text uppercase">{name}</span>
    </span>
  );
}
