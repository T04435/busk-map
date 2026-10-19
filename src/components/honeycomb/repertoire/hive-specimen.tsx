import type { ReactNode } from "react";
import { cn } from "cn";
import { AgentLockup } from "@/components/honeycomb/agent-lockup";
import { AgentStatusLine, type AgentState } from "@/components/honeycomb/agent-status-line";
import { AgentTag } from "@/components/honeycomb/agent-tag";
import { HIVE_SIZES, HiveMark, type HiveAnim, type HiveSource } from "@/components/honeycomb/hive-mark";
import { MeetTheHive } from "@/components/honeycomb/meet-the-hive";

/** The board's five animations, its codes and one-line descriptions (Hive Identity, section 1). */
const ANIMS: { anim: HiveAnim; code: string; name: string; text: string }[] = [
  {
    anim: "origami",
    code: "4i",
    name: "Origami in turn · default",
    text: "Each outer cell lifts in perspective, flips and lands face-down on the centre, one at a time, until only the centre shows, then they open in reverse.",
  },
  { anim: "flip", code: "3b", name: "Flip", text: "Cells flip edge-on like coins, one after another around the ring." },
  { anim: "bud", code: "3e", name: "Bud", text: "Cells grow out of the centre and slide into their slots, then retract into it." },
  { anim: "comet", code: "2b", name: "Comet", text: "One scout cell circles the centre with a fading trail of two cells behind it." },
  { anim: "wave", code: "2d", name: "Wave", text: "A size ripple travels around the ring; continuous, never fully at rest." },
];

/** The board's three single-source rows (section 2). */
const SOURCES: { source: HiveSource; name: string; text: string }[] = [
  { source: "qloo", name: "Qloo", text: "Taste map, crowds, local scene, fans, sounds-like, genres, venues" },
  { source: "spotify", name: "Spotify", text: "Profile and photo, songs, top tracks, covers, years, lengths, links" },
  { source: "lastfm", name: "Last.fm", text: "Song plays and top tracks (Spotify backup)" },
];

const STATES: AgentState[] = ["researching", "rerun", "done", "replayed", "engine", "none"];

const EYEBROW = "m-0 font-mono text-xs leading-4 font-bold tracking-[0.2em] text-muted-foreground uppercase";
const CAPTION = "font-mono text-[11px] leading-4 font-medium text-muted-foreground";

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
      <figcaption className={CAPTION}>{caption}</figcaption>
    </figure>
  );
}

/** A board section: always on the night panel, as on the board, so the two compare side by side in either theme. */
function BoardSection({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="bm-night flex min-w-0 flex-col gap-6 bg-background p-4 text-foreground md:p-8">
      <div className="flex flex-col gap-2">
        <p className={EYEBROW}>{eyebrow}</p>
        <h2 className="m-0 font-display text-[40px] leading-[38px] font-extrabold [overflow-wrap:anywhere]">{title}</h2>
        {intro ? <p className="m-0 max-w-3xl text-base leading-6 text-muted-foreground">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Section 1, one card per animation: 104, 24, 16, 14; the day strip; the reduced-motion frame; the description. */
function AnimCard({ anim, code, name, text }: (typeof ANIMS)[number]) {
  return (
    <article className="flex w-full max-w-[340px] min-w-0 flex-col gap-4 border-2 border-rule bg-card p-4" data-anim={anim}>
      <h3 className="m-0 font-mono text-xs leading-4 font-bold tracking-[0.12em] uppercase">
        <span className="text-muted-foreground normal-case">{code}</span> {name}
      </h3>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        {[104, 24, 16, 14].map((n) => (
          <span key={n} className="flex flex-col items-center gap-1.5">
            <HiveMark size={n} state="working" anim={anim} decorative />
            <span className={CAPTION}>{n}</span>
          </span>
        ))}
      </div>
      {/* The day strip: the day colour on the board's paper. */}
      <div className="flex flex-wrap items-center gap-4 bg-hive-paper px-3 py-2.5 [--hive:var(--hive-day)]">
        <HiveMark size={48} state="working" anim={anim} decorative />
        <HiveMark size={16} state="working" anim={anim} decorative />
        <span className="inline-flex items-center gap-1.5">
          <HiveMark size={14} state="working" anim={anim} decorative />
          <span className="font-mono text-xs leading-4 font-bold tracking-[0.08em] text-hive uppercase">The Hive</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <HiveMark size={24} state="working" anim={anim} motion={false} decorative />
        <span className="font-mono text-[11px] leading-4 font-bold tracking-[0.12em] text-muted-foreground uppercase">Reduced-motion frame</span>
      </div>
      <p className="m-0 text-sm leading-5 text-muted-foreground">{text}</p>
    </article>
  );
}

const GRID = "lg:grid lg:grid-cols-[minmax(180px,1fr)_repeat(5,112px)_minmax(150px,auto)] lg:items-center lg:gap-x-4";

/** Section 2: the source × animation grid at 72, and the 24 · 16 · day column. */
function SourceGrid() {
  return (
    <div className="flex min-w-0 flex-col">
      <div className={cn("hidden border-b border-border pb-4", GRID)} aria-hidden="true">
        {["SOURCE", ...ANIMS.map((a) => `${a.code} ${a.anim.toUpperCase()}`), "24 · 16 · DAY"].map((t) => (
          <span key={t} className={cn(EYEBROW, "text-foreground normal-case")}>
            {t}
          </span>
        ))}
      </div>
      {SOURCES.map(({ source, name, text }) => (
        <div key={source} className={cn("flex flex-col gap-4 border-b border-border py-6", GRID)} data-source={source}>
          <div className="min-w-0">
            <h3 className="m-0 font-display text-[26px] leading-7 font-extrabold">{name}</h3>
            <p className="m-0 mt-1 text-sm leading-5 text-muted-foreground">{text}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:contents">
            {ANIMS.map((a) => (
              <span key={a.anim} className="flex flex-col items-center gap-1.5 lg:justify-self-center">
                <HiveMark size={72} state="working" anim={a.anim} source={source} decorative />
                <span className={cn(CAPTION, "lg:sr-only")}>
                  {a.code} {a.anim}
                </span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-5">
            <HiveMark size={24} state="working" source={source} decorative />
            <HiveMark size={16} state="working" source={source} decorative />
            <span className="inline-flex border border-border bg-hive-paper p-1.5 [--hive:var(--hive-day)]">
              <HiveMark size={24} state="working" source={source} decorative />
            </span>
            <span className={cn(CAPTION, "lg:sr-only")}>24 · 16 · day</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The product's own sizes (HIVE_SIZES: the board's README sizes made 20% larger), each where it is used. */
const PRODUCT: { key: keyof typeof HIVE_SIZES; use: string; source?: HiveSource; working?: boolean }[] = [
  { key: "tag", use: "inline tag" },
  { key: "badge", use: "found-by, proposed spot" },
  { key: "eyebrow", use: "agent vs engine" },
  { key: "step", use: "running step (in a 57 cell)", source: "qloo", working: true },
  { key: "status", use: "status line", working: true },
  { key: "lockup", use: "research header" },
  { key: "card", use: "meet the hive" },
];

/** The Hive persona specimen (?state=hive): the board's two sections 1:1, then every product size and each piece that carries the mark. Sample copy only. */
export function HiveSpecimen() {
  return (
    <div className="flex flex-col gap-10">
      <BoardSection
        eyebrow="Working state · selected animations"
        title="How the Hive looks while it researches"
      >
        <div className="flex flex-wrap gap-4">
          {ANIMS.map((a) => (
            <AnimCard key={a.anim} {...a} />
          ))}
        </div>
      </BoardSection>
      <BoardSection
        eyebrow="Working state · single-source steps"
        title="The centre cell shows the source"
        intro={
          <>
            When a step runs on one known source, the centre cell takes that source&apos;s colour and logo while the outer cells keep animating in Hive
            orange. Below 20px the logo drops and only the colour stays. Steps that mix sources keep the plain mark. Set with the <code className="font-mono">source</code> prop: qloo,
            spotify, lastfm.
          </>
        }
      >
        <SourceGrid />
      </BoardSection>
      <Block title="Product sizes · the board's sizes + 20% (HIVE_SIZES)">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          {PRODUCT.map(({ key, use, source, working }) => (
            <Fig key={key} caption={`${HIVE_SIZES[key]} · ${use}`}>
              <HiveMark size={HIVE_SIZES[key]} state={working ? "working" : "rest"} source={source} />
            </Fig>
          ))}
          <Fig caption={`${HIVE_SIZES.status} · Hive didn't run`}>
            <HiveMark size={HIVE_SIZES.status} muted />
          </Fig>
        </div>
      </Block>
      <Block title="Research header lockup">
        <div className="grid gap-6 md:grid-cols-2">
          <AgentLockup live status="is researching your busk" />
          <AgentLockup />
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
          Busy here on Friday evenings. That&apos;s an estimate from Qloo: popular places open nearby.
        </p>
      </Block>
      <Block title="Brain card">
        <MeetTheHive className="max-w-2xl" />
      </Block>
    </div>
  );
}
