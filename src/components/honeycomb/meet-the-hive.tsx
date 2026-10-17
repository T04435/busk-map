import { AiChip } from "@/components/honeycomb/ai-chip";
import { HiveMark } from "@/components/honeycomb/hive-mark";
import { AGENT_NAME_INLINE, AGENT_NAME_START } from "@/lib/agent-persona";
import { NoteCard } from "@/components/honeycomb/note-card";

/** The Brain page's card introducing the agent: the full comb, what it is and what it runs on. `modelLabel` keeps the model true. */
export function MeetTheHive({ modelLabel = "Claude (Sonnet 5.5)", className }: { modelLabel?: string; className?: string }) {
  return (
    <NoteCard title={`Meet ${AGENT_NAME_INLINE}`} className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <HiveMark size={96} className="flex-none" />
        <div className="flex min-w-0 flex-col items-start gap-3">
          <p className="m-0">
            {AGENT_NAME_START} is Busk Map&apos;s research agent. It runs on {modelLabel}, made by Anthropic. {AGENT_NAME_START} picks which Qloo
            questions to ask, but never makes up a number.
          </p>
          <AiChip />
        </div>
      </div>
    </NoteCard>
  );
}
