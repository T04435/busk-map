import { cn } from "cn";
import { HIVE_SIZES, HiveMark } from "@/components/honeycomb/hive-mark";
import { AGENT_NAME_START } from "@/lib/agent-persona";

/**
 * The research header lockup (Hive Identity board): the Hive's mark (HIVE_SIZES.lockup, the hive token) beside its name in
 * a bordered mono tag in signal-text, and what it is doing in muted body under the tag. `live` runs the mark's working animation; otherwise it rests,
 * all seven cells full. Spans only, so it can sit in a fold button.
 */
export function AgentLockup({
  live,
  status,
  name = AGENT_NAME_START,
  size = HIVE_SIZES.lockup,
  className,
}: {
  live?: boolean;
  /** What the agent is doing, after its name: "is researching your busk". None once it is done. */
  status?: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span data-slot="agent-lockup" className={cn("flex min-w-0 items-start gap-3.5", className)}>
      <HiveMark size={size} state={live ? "working" : "rest"} decorative />
      <span className="flex min-w-0 flex-col items-start gap-1.5">
        <span className="border-2 border-signal-text px-2.5 py-1 font-mono text-sm leading-5 font-bold tracking-[0.12em] whitespace-nowrap text-signal-text uppercase">
          {name}
        </span>
        {status ? <span className="text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">{status}</span> : null}
      </span>
    </span>
  );
}
