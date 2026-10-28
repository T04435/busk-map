import type { Metadata } from "next";
import Link from "next/link";
import { BrainMap } from "@/components/brain/brain-map";
import { Icon } from "@/components/honeycomb/icon";
import { MeetTheHive } from "@/components/honeycomb/meet-the-hive";
import { NoteCard } from "@/components/honeycomb/note-card";
import { StatStrip } from "@/components/honeycomb/stat-strip";
import { callKinds, facts, next, quotaNote, routingNote } from "@/lib/qloo-map";

export const metadata: Metadata = {
  title: "The brain of Busk Map",
  description: "How Qloo's taste data flows through Busk Map: every kind of Qloo call, the data it returns and the part of your busk it decides.",
};

/** A faint hex lattice behind everything (B-114): one 56x100 tile of pointy-top hexagons. */
const LATTICE = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="100"><path d="M28 0v33M0 16.5l28 16.5 28-16.5M28 66v34M0 83.5l28-16.5 28 16.5M0 50l28 16.5L56 50M0 16.5V50M56 16.5V50" fill="none" stroke="#f2ede4" stroke-opacity=".045"/></svg>',
)}")`;

/**
 * "The brain of Busk Map": the deck draws it on the dark grain ground whichever theme the visitor is in (like the landing's
 * dark bands), so the page pins `data-theme="dark"`. The wiring and its trace panel are the BrainMap.
 */
export default function BrainPage() {
  return (
    <main id="main" data-theme="dark" className="bm-grain flex-1 bg-background text-foreground" style={{ backgroundImage: `${LATTICE}, radial-gradient(color-mix(in oklab, var(--foreground) 9%, transparent) 0.8px, transparent 1.2px)`, backgroundSize: "56px 100px, 4px 4px" }}>
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 px-4 pt-8 pb-16 md:px-6 md:pt-16">
        <header className="flex max-w-[900px] flex-col gap-[18px]">
          <span className="font-display text-[clamp(24px,4vw,36px)] leading-none font-extrabold text-slate uppercase">Taste data from the Qloo API</span>
          <h1 className="m-0 font-display text-[clamp(56px,9vw,128px)] leading-[0.86] font-extrabold uppercase">
            <span className="sr-only">Taste data from the Qloo API: </span>
            The <span className="text-slate">brain</span>
            <br />
            of Busk Map
          </h1>
          <p className="m-0 max-w-[640px] text-[19px] leading-[29px]">
            Qloo knows who likes what, and where. Busk Map asks it {callKinds} kinds of question, and every answer lands somewhere in your busk.
          </p>
          <p className="m-0 max-w-[640px] font-mono text-sm leading-6 text-muted-foreground" data-testid="qloo-routing">
            {routingNote}
          </p>
        </header>

        <section aria-label="Qloo calls per busk">
          <StatStrip tone="qloo" items={facts.map((f) => ({ n: f.value, label: f.label }))} />
        </section>

        <BrainMap />

        <section aria-labelledby="notes" className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
          <h2 id="notes" className="sr-only">
            Notes
          </h2>
          <MeetTheHive />
          <NoteCard title="Numbers come from data">
            <p className="m-0">
              The Hive, our agent, picks which Qloo questions to ask, but never makes up a number: it can only choose among pitches Busk Map&apos;s engine
              scored, and a busk that cites a number no call returned is rejected.
            </p>
          </NoteCard>
          <NoteCard title="Light on the quota">
            <p className="m-0" data-testid="quota-note">
              {quotaNote}
            </p>
          </NoteCard>
          <NoteCard variant="next">
            <ul className="m-0 list-disc pl-[18px] text-muted-foreground">
              {next.map((n) => (
                <li key={n.id}>{n.label}</li>
              ))}
            </ul>
          </NoteCard>
        </section>

        <Link className="flex min-h-tap items-center gap-2 self-start font-mono text-base font-bold text-primary hover:underline underline-offset-3" href="/">
          <Icon name="arrow-left" size={16} />
          Back to Busk Map
        </Link>
      </div>
    </main>
  );
}
