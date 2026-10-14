import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { PerformerForm } from "@/components/landing/performer-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EXAMPLES } from "@/lib/examples";
import { localToday, nextWeekday } from "@/lib/slot";
import { SOURCES } from "@/lib/sources";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-12">
      <header className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Busk Map</h1>
        <p className="text-lg text-muted-foreground">
          Know where to play, and what to play there. Busk Map finds the street pitches whose crowd matches your music at the hour you
          want to play, and orders your setlist for each one.
        </p>
        <p className="text-sm text-muted-foreground">
          Melbourne: Qloo taste data, the city&apos;s pedestrian sensors and busking rules, Ticketmaster events and the weather.
        </p>
      </header>

      <section aria-labelledby="examples" className="space-y-4">
        <h2 id="examples" className="text-xl font-semibold">
          Try an example performer
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {EXAMPLES.map((example) => (
            <li key={example.id}>
              <Link href={`/plan?example=${example.id}`} className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <Card className="h-full transition-colors hover:bg-muted">
                  <CardHeader>
                    <CardTitle>{example.label}</CardTitle>
                    <CardDescription>{example.blurb}</CardDescription>
                    <CardDescription>Sounds like {example.performer.artists.slice(0, 3).join(", ")}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Separator />

      <section aria-labelledby="own" className="max-w-2xl space-y-4">
        <h2 id="own" className="text-xl font-semibold">
          Or plan for your own act
        </h2>
        <Suspense>
          <OwnActForm />
        </Suspense>
      </section>

      <footer className="space-y-1 text-xs text-muted-foreground">
        <p>Data: {[SOURCES.qloo, SOURCES["melbourne-pedestrian"], SOURCES["melbourne-busking"], SOURCES.ticketmaster, SOURCES.lastfm, SOURCES["open-meteo"], SOURCES.spotify].map((s) => s.name).join(" · ")}</p>
        <p>
          Busk Map never confirms a pitch is legal; check your permit conditions. Built for the Qloo Agentic Hackathon. MIT licence.
        </p>
      </footer>
    </main>
  );
}

async function OwnActForm() {
  // The default date depends on today, so render it at request time.
  await connection();
  return <PerformerForm defaultDate={nextWeekday("saturday", localToday("Australia/Melbourne"))} />;
}
