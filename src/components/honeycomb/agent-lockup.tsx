import { cn } from "cn";
import { AiChip } from "@/components/honeycomb/ai-chip";
import { HiveMark } from "@/components/honeycomb/hive-mark";
import { AGENT_NAME_START } from "@/lib/agent-persona";

/**
 * The research header lockup: the Hive's mark (40) beside its name in display caps, what it is doing in muted body under the
 * name, then the AI chip. The mark carries `progress`; `live` pulses the next cell. Spans only, so it can sit in a fold button.
 */
export function AgentLockup({
  progress,
  live,
  status,
  name = AGENT_NAME_START,
  size = 40,
  className,
}: {
  progress?: number;
  live?: boolean;
  /** What the agent is doing, after its name: "is researching your busk". */
  status: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span data-slot="agent-lockup" className={cn("flex min-w-0 items-start gap-3", className)}>
      <HiveMark size={size} progress={progress} live={live} className="mt-0.5" />
      <span className="flex min-w-0 flex-col items-start gap-1">
        <span className="font-display text-2xl leading-6 font-extrabold uppercase">{name}</span>
        <span className="text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">{status}</span>
        <AiChip className="mt-1" />
      </span>
    </span>
  );
}
