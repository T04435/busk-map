import type { ReactNode } from "react";
import { AgentLockup } from "@/components/honeycomb/agent-lockup";
import { AgentStatusLine, type AgentState } from "@/components/honeycomb/agent-status-line";
import { AgentTag } from "@/components/honeycomb/agent-tag";
import { HiveMark, type HiveAnim, type HiveSource } from "@/components/honeycomb/hive-mark";
import { MeetTheHive } from "@/components/honeycomb/meet-the-hive";

const ANIMS: HiveAnim[] = ["origami", "flip", "bud", "comet", "wave"];
const SOURCES: HiveSource[] = ["qloo", "spotify", "lastfm"];
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
      <Block title="The mark · at rest, sizes">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          {[104, 72, 28, 24, 16, 14].map((n) => (
            <Fig key={n} caption={String(n)}>
              <HiveMark size={n} />
            </Fig>
          ))}
          <Fig caption="24 · Hive didn't run">
            <HiveMark size={24} muted />
          </Fig>
        </div>
      </Block>
      <Block title="Working · the five animations (origami is the default)">
        {[104, 24, 16, 14].map((n) => (
          <div key={n} className="flex flex-wrap items-end gap-x-8 gap-y-4">
            {ANIMS.map((a) => (
              <Fig key={a} caption={`${a} · ${n}`}>
                <HiveMark size={n} state="working" anim={a} />
              </Fig>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          {ANIMS.map((a) => (
            <Fig key={a} caption={`${a} · frozen`}>
              <HiveMark size={48} state="working" anim={a} motion={false} />
            </Fig>
          ))}
        </div>
      </Block>
      <Block title="Working · the centre cell shows the source (logo from 20px)">
        {[48, 24, 16].map((n) => (
          <div key={n} className="flex flex-wrap items-end gap-x-8 gap-y-4">
            {SOURCES.map((src) => (
              <Fig key={src} caption={`${src} · ${n}`}>
                <HiveMark size={n} state="working" source={src} />
              </Fig>
            ))}
          </div>
        ))}
      </Block>
      <Block title="Research header lockup">
        <div className="grid gap-6 md:grid-cols-2">
          <AgentLockup live status="is researching your busk" />
          <AgentLockup status="researched your act" />
        </div>
      </Block>
      <Block title="Status line · every state">
        <div className="flex flex-col gap-4">
          {STATES.map((s) => (
            <AgentStatusLine key={s} state={s} />
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
    </div>
  );
}
