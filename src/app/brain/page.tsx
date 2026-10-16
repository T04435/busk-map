import type { Metadata } from "next";
import Link from "next/link";
import { BrainMap } from "@/components/brain/brain-map";
import { QlooLink } from "@/components/honeycomb/logo";
import { NoteCard } from "@/components/honeycomb/note-card";
import { StatStrip } from "@/components/honeycomb/stat-strip";
import { callKinds, facts, next, quotaNote } from "@/lib/qloo-map";

export const metadata: Metadata = {
  title: "The brain of Busk Map",
  description: "How Qloo's taste data flows through Busk Map: every kind of Qloo call, the data it returns and the part of your busk it decides.",
};

/**
 * "The brain of Busk Map": the deck draws it on the dark grain ground whichever theme the visitor is in (like the landing's
 * dark bands), so the page pins `data-theme="dark"`. The wiring and its trace panel are the BrainMap.
 */
export default function BrainPage() {
  return (
    <main id="main" data-theme="dark" className="bm-grain flex-1 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 px-4 pt-8 pb-16 md:px-6 md:pt-16">
        <header className="flex max-w-[900px] flex-col gap-[18px]">
          <span className="inline-flex flex-wrap items-center gap-3.5 font-display text-[clamp(24px,4vw,36px)] leading-none font-extrabold text-qloo uppercase">
            Powered by
            <QlooLink width={200} className="w-[clamp(120px,26vw,200px)]" wordmarkClassName="h-auto w-full text-foreground" />
          </span>
          <h1 className="m-0 font-display text-[clamp(56px,9vw,128px)] leading-[0.86] font-extrabold uppercase">
            <span className="sr-only">Powered by Qloo: </span>
            The <span className="text-qloo">brain</span>
            <br />
            of Busk Map
          </h1>
          <p className="m-0 max-w-[640px] text-[19px] leading-[29px]">
            Qloo knows who likes what, and where. Busk Map asks it {callKinds} kinds of question, and every answer lands somewhere in your busk.
            Pick any piece below to trace its path.
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
          <NoteCard title="Numbers come from data">
            <p className="m-0">
              Claude picks which Qloo questions to ask, but never makes up a number: it can only choose among pitches Busk Map&apos;s engine
              scored, and a plan that cites a number no call returned is rejected.
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

        <Link className="flex min-h-tap items-center self-start font-mono text-base font-bold text-foreground underline underline-offset-3 hover:decoration-2" href="/">
          ← Back to Busk Map
        </Link>
      </div>
    </main>
  );
}
