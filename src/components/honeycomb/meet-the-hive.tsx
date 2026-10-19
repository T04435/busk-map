import { HIVE_SIZES, HiveMark } from "@/components/honeycomb/hive-mark";
import { AGENT_NAME_INLINE, AGENT_NAME_START } from "@/lib/agent-persona";
import { NoteCard } from "@/components/honeycomb/note-card";

/** The Brain page's card introducing the agent: the full comb at rest and what it does. The agent is only ever called the Hive. */
export function MeetTheHive({ className }: { className?: string }) {
  return (
    <NoteCard title={`Meet ${AGENT_NAME_INLINE}`} className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <HiveMark size={HIVE_SIZES.card} className="flex-none" />
        <p className="m-0">
          {AGENT_NAME_START} is Busk Map&apos;s research agent. {AGENT_NAME_START} picks which Qloo questions to ask, but never makes up a number.
        </p>
      </div>
    </NoteCard>
  );
}
