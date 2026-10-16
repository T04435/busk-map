import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { PerformerForm } from "@/components/landing/performer-form";
import { Warmup } from "@/components/landing/warmup";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EXAMPLES } from "@/lib/examples";
import { localToday, nextWeekday, weekdayOf } from "@/lib/slot";
import { loadStoredPlan } from "@/server/plans";
import { SOURCES } from "@/lib/sources";
import { CALLS_PER_NEW_BUSK, callKinds, featureCount } from "@/lib/qloo-map";
import { Button } from "@/components/ui/button";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-12">
      <Warmup />
      <header className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Busk Map</h1>
        <p className="text-lg text-muted-foreground">
          Know where to play, and what to play there. Busk Map finds the street pitches whose crowd matches your music at the hour you
          want to play, and orders your setlist for each one.
        </p>
        <p className="text-muted-foreground">
          Not the spots every busker already plays: Busk Map starts from where your crowd&apos;s taste concentrates on Qloo&apos;s taste map,
          checks the council&apos;s busking rules, then weighs real foot traffic for your slot. It flags the hidden gems.
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
              {/* No prefetch: each click makes a new plan link and starts a fresh agent run (presets are inputs only). */}
              <Link prefetch={false} href={`/plan?example=${example.id}`} className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
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
        <p className="text-sm text-muted-foreground">
          Or plan a whole week:{" "}
          {EXAMPLES.map((example, i) => (
            <span key={example.id}>
              {i > 0 && " · "}
              <Link className="underline" prefetch={false} href={`/week?example=${example.id}`}>
                Week: {example.label}
              </Link>
            </span>
          ))}
        </p>
        <p className="text-sm text-muted-foreground">
          Played a session? Log your takings in the{" "}
          <Link className="underline" href="/tips">
            tip log
          </Link>
          : it stays in this browser, and pitches where you earn more get a small bonus in your next plans.
        </p>
      </section>

      <Separator />

      <section aria-labelledby="own" className="max-w-2xl space-y-4">
        <h2 id="own" className="text-xl font-semibold">
          Or plan for your own act
        </h2>
        <Suspense>
          <OwnActForm searchParams={searchParams} />
        </Suspense>
      </section>

      <section aria-labelledby="brain" className="max-w-2xl space-y-3" data-testid="brain-teaser">
        <h2 id="brain" className="text-xl font-semibold">
          The brain of Busk Map
        </h2>
        <p className="text-muted-foreground">
          Powered by Qloo: {callKinds} kinds of Qloo call, {CALLS_PER_NEW_BUSK} of them for a new busk and none on a rerun, decide{" "}
          {featureCount} parts of your plan. See how every answer flows into your busk.
        </p>
        <Button asChild variant="outline">
          <Link href="/brain">
            Open the brain <span aria-hidden="true">→</span>
          </Link>
        </Button>
      </section>

      <footer className="space-y-1 text-xs text-muted-foreground">
        <p>Data: {[SOURCES.qloo, SOURCES["melbourne-pedestrian"], SOURCES["melbourne-busking"], SOURCES.ticketmaster, SOURCES.lastfm, SOURCES["open-meteo"], SOURCES.spotify, SOURCES.osm].map((s) => s.name).join(" · ")}</p>
        <p>
          Busk Map never confirms a pitch is legal; check your permit conditions. Built for the Qloo Agentic Hackathon. MIT licence.
        </p>
      </footer>
    </main>
  );
}

/** `?again=<plan id>` (from a plan whose slot has passed): the form pre-filled with that act, on the next same weekday. */
async function OwnActForm({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const again = (await searchParams).again;
  // The default date depends on today, so render it at request time.
  await connection();
  const today = localToday("Australia/Melbourne");
  const stored = typeof again === "string" ? await loadStoredPlan(again).catch(() => null) : null;
  if (!stored) return <PerformerForm defaultDate={nextWeekday("saturday", today)} today={today} />;
  const { performer, permit, slot } = stored.request;
  return (
    <PerformerForm
      key={stored.id}
      defaultDate={nextWeekday(weekdayOf(slot.date), today)}
      today={today}
      prefill={{ performer, permit, startHour: slot.startHour, endHour: slot.endHour }}
    />
  );
}
