import type { ReactNode } from "react";
import { AgentLockup } from "@/components/honeycomb/agent-lockup";
import { AgentStatusLine, type AgentState } from "@/components/honeycomb/agent-status-line";
import { AgentTag } from "@/components/honeycomb/agent-tag";
import { AiChip } from "@/components/honeycomb/ai-chip";
import { HiveMark } from "@/components/honeycomb/hive-mark";
import { MeetTheHive } from "@/components/honeycomb/meet-the-hive";

const STATES: AgentState[] = ["researching", "rerun", "done", "replayed", "engine", "none"];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t-2 border-rule pt-4">
      <h2 className="m-0 font-mono text-xs leading-4 font-bold tracking-[0.06em] uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Fig({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="m-0 flex flex-col items-center gap-2">
      <span className="grid min-h-24 place-items-center">{children}</span>
      <figcaption className="font-mono text-[11px] leading-4 font-medium text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

/** The Hive persona specimen (?state=hive): the mark at every size and step, and each piece that carries it. Sample copy only. */
export function HiveSpecimen() {
  return (
    <div className="flex flex-col gap-10">
      <Block title="The mark · sizes">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Fig caption="96 · Brain">
            <HiveMark size={96} />
          </Fig>
          <Fig caption="40 · header">
            <HiveMark size={40} />
          </Fig>
          <Fig caption="24 · running, 3">
            <HiveMark size={24} live progress={3} label="The Hive, 3 of 7 steps done" />
          </Fig>
          <Fig caption="24 · done">
            <HiveMark size={24} />
          </Fig>
          <Fig caption="14 · tag">
            <HiveMark size={14} />
          </Fig>
          <Fig caption="24 · none">
            <HiveMark size={24} muted />
          </Fig>
        </div>
      </Block>
      <Block title="Progress 0–7 · 40, live">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <Fig key={n} caption={String(n)}>
              <HiveMark size={40} progress={n} live />
            </Fig>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <Fig key={n} caption={`${n} · 24`}>
              <HiveMark size={24} progress={n} />
            </Fig>
          ))}
        </div>
      </Block>
      <Block title="Research header lockup">
        <div className="grid gap-6 md:grid-cols-2">
          <AgentLockup live progress={3} status="is researching your busk" />
          <AgentLockup progress={7} status="researched your act" />
        </div>
      </Block>
      <Block title="Status line · every state">
        <div className="flex flex-col gap-4">
          {STATES.map((s) => (
            <AgentStatusLine key={s} state={s} progress={s === "researching" ? 3 : undefined} />
          ))}
          <AgentStatusLine state="done" model="mock" />
        </div>
      </Block>
      <Block title="Step card tag">
        <p className="m-0 max-w-xl text-sm leading-5 text-muted-foreground">
          <AgentTag />
          Recent Fridays averaged about 1,900 people an hour. That&apos;s an estimate from a city sensor 80 m away.
        </p>
      </Block>
      <Block title="Brain card">
        <MeetTheHive className="max-w-2xl" />
      </Block>
      <Block title="AI chip">
        <div>
          <AiChip />
        </div>
      </Block>
    </div>
  );
}
