import type { Metadata } from "next";
import Link from "next/link";
import { BrainMap } from "@/components/brain/brain-map";
import { callKinds, facts, next, quotaNote } from "@/lib/qloo-map";

export const metadata: Metadata = {
  title: "The brain of Busk Map",
  description: "How Qloo's taste data flows through Busk Map: every kind of Qloo call, the data it returns and the part of your busk it decides.",
};

export default function BrainPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8">
      <nav className="text-sm">
        <Link className="underline" href="/">
          Busk Map home
        </Link>
      </nav>

      <header className="max-w-3xl space-y-4">
        <h1 className="flex flex-col gap-1">
          <span className="text-base font-medium text-muted-foreground">The brain of Busk Map, powered by</span>
          <span className="text-6xl font-semibold tracking-tight sm:text-7xl">Qloo</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          Qloo knows who likes what, and where. Busk Map asks it {callKinds} kinds of question, and every answer lands somewhere in your busk.
          Pick any piece below to trace its path.
        </p>
      </header>

      <section aria-labelledby="facts" className="space-y-3">
        <h2 id="facts" className="sr-only">
          Qloo calls per busk
        </h2>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
          {facts.map((f) => (
            <li key={f.label} className="flex flex-col gap-1 bg-background p-4">
              <span className="text-3xl font-semibold tracking-tight">{f.value}</span>
              <span className="text-sm text-muted-foreground">{f.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <BrainMap />

      <section aria-labelledby="notes" className="grid gap-4 md:grid-cols-3">
        <h2 id="notes" className="sr-only">
          Notes
        </h2>
        <div className="space-y-2 rounded-xl border p-4">
          <h3 className="font-semibold">Numbers come from data</h3>
          <p className="text-sm text-muted-foreground">
            Claude picks which Qloo questions to ask, but never makes up a number: it can only choose among pitches Busk Map&apos;s engine
            scored, and a plan that cites a number no call returned is rejected.
          </p>
        </div>
        <div className="space-y-2 rounded-xl border p-4">
          <h3 className="font-semibold">Light on the quota</h3>
          <p className="text-sm text-muted-foreground" data-testid="quota-note">
            {quotaNote}
          </p>
        </div>
        <div className="space-y-2 rounded-xl border border-dashed p-4">
          <h3 className="font-semibold">Next (not built yet)</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {next.map((n) => (
              <li key={n.id}>{n.label}</li>
            ))}
          </ul>
        </div>
      </section>

      <p className="text-sm">
        <Link className="underline" href="/">
          ← Back to Busk Map
        </Link>
      </p>
    </main>
  );
}
