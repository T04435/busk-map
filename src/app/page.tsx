import Link from "next/link";
import { ArrowRight, Clock, MapPin, Music, Scale } from "lucide-react";
import { ExampleActCard } from "@/components/honeycomb/example-act-card";
import { QlooWordmark } from "@/components/honeycomb/logo";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { StatStrip } from "@/components/honeycomb/stat-strip";
import { HeroTasteMap } from "@/components/landing/hero-taste-map";
import { OwnRedirect } from "@/components/landing/own-redirect";
import { Warmup } from "@/components/landing/warmup";
import { WhatYouGet } from "@/components/landing/what-you-get";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EXAMPLES } from "@/lib/examples";
import { CALLS_ON_RERUN, CALLS_PER_NEW_BUSK, callKinds, featureCount } from "@/lib/qloo-map";
import { SOURCES } from "@/lib/sources";

const H2 = "m-0 font-display text-[clamp(44px,5vw,72px)] leading-[0.92] font-extrabold uppercase";
// The hex lattice behind the hero and the dark bands: a honeycomb in hairlines, one cell wide at 48.5px.
const LATTICE =
  "M24.2 0 L48.5 14 L48.5 42 L24.2 56 L0 42 L0 14Z M0 42 L24.2 56 L24.2 84 L0 98 L-24.2 84 L-24.2 56Z M48.5 42 L72.7 56 L72.7 84 L48.5 98 L24.2 84 L24.2 56Z M24.2 84 L48.5 98 L48.5 126 L24.2 140 L0 126 L0 98Z M0 -42 L24.2 -28 L24.2 0 L0 14 L-24.2 0 L-24.2 -28Z M48.5 -42 L72.7 -28 L72.7 0 L48.5 14 L24.2 0 L24.2 -28Z";

const TICKER = ["Qloo taste map", "Qloo crowd at each pitch", "Qloo venue and event crowds", "Qloo audience age", "foot traffic for your hour", "3 pitches for you"];

const PROBLEMS = [
  { icon: MapPin, title: "Where?", guess: "Bourke Street Mall, like every other busker.", fix: "Southbank Promenade: the strongest folk taste area on Qloo." },
  { icon: Clock, title: "When?", guess: "Turn up at noon and hope.", fix: "About 1,900 people an hour, and a matinee lets out at 2:45 pm." },
  { icon: Scale, title: "Allowed?", guess: "The station steps, until a ranger moves you on.", fix: "A general-permit pitch, clear of the no-busking zones." },
  { icon: Music, title: "What to play?", guess: "Wonderwall, again.", fix: "Open with Fast Car: the song this crowd knows best." },
];

const BEYOND = [
  { title: "Every street act", body: "Magicians, living statues, chalk artists: the same pitches, rules and hours, with a routine in place of a setlist." },
  { title: "Council pitch plans", body: "Councils see which licensed pitches suit which kinds of act, and where a new pitch would draw a crowd." },
  { title: "Coffee carts and food trucks", body: "Mobile traders with street permits: where and when their kind of customer walks past." },
];

export default function Home() {
  return (
    <main id="main" className="flex-1">
      <Warmup />
      <OwnRedirect />

      <section data-theme="dark" aria-labelledby="hero" className="bm-grain relative overflow-hidden border-b-[6px] border-primary bg-background text-foreground">
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" focusable="false">
          <defs>
            <pattern id="hero-lattice" width="48.497" height="84" patternUnits="userSpaceOnUse">
              <path d={LATTICE} fill="none" stroke="var(--foreground)" strokeOpacity={0.07} strokeWidth={1} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-lattice)" />
        </svg>
        <div className="relative mx-auto flex max-w-[1360px] flex-wrap items-start gap-x-14 gap-y-10 px-4 py-12 md:px-6 md:py-16">
          {/* The headline sizes itself to its column (19cqw) so "What to play." always stays on one line, as in the deck (B-025). */}
          <div className="flex min-w-0 flex-[1.2_1_520px] flex-col gap-7 pt-4 [container-type:inline-size] md:pt-6">
            <h1 id="hero" className="m-0 font-display text-[min(19cqw,clamp(64px,9vw,136px))] leading-[0.86] font-extrabold uppercase">
              <span className="sr-only">Busk Map: </span>
              Where to busk.
              <br />
              When.
              <br />
              <span className="whitespace-nowrap text-signal-text">What to play.</span>
            </h1>
            <p className="m-0 max-w-xl text-lg leading-[27px]">
              Busk Map finds the street pitches whose crowd matches your music at the hour you want to play, and orders your setlist for each one.
            </p>
          </div>
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-4">
            <figure className="m-0 flex flex-col gap-2.5">
              <HeroTasteMap label="An illustration of Qloo's taste map for a folk duo, with their three pitches" />
              <figcaption className="font-mono text-xs leading-4 font-medium text-muted-foreground">
                An example of Qloo&apos;s taste map for a folk duo: the brighter the cell, the more their crowd gathers there.
              </figcaption>
            </figure>
            <Link
              href="/busks"
              className="flex min-h-[76px] items-center justify-between border-2 border-foreground bg-primary px-8 font-display text-[34px] leading-none font-extrabold text-primary-foreground uppercase no-underline bm-poster [--poster-shadow:6px_6px_0_var(--foreground)] hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--foreground))]"
            >
              Plan a busk
              <ArrowRight aria-hidden="true" className="size-9" />
            </Link>
          </div>
          <div className="flex basis-full flex-wrap items-center justify-center gap-x-7 gap-y-4 pt-4 text-qloo">
            <span className="font-display text-[clamp(26px,5vw,44px)] leading-none font-extrabold tracking-[0.02em] whitespace-nowrap uppercase">In partnership with</span>
            <QlooWordmark width={160} className="h-auto w-[clamp(96px,22vw,160px)] text-foreground" />
          </div>
        </div>
      </section>

      <div aria-hidden="true" className="overflow-hidden border-b-2 border-rule bg-primary py-3 text-primary-foreground">
        <div className="hc-ticker flex gap-10 font-display text-[28px] leading-none font-extrabold whitespace-nowrap uppercase">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 gap-10">
              {TICKER.map((item) => (
                <span key={item} className="flex gap-10">
                  {item}
                  <span>·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-[1360px] flex-col gap-20 px-4 pt-16 pb-16 md:gap-28 md:px-6 md:pt-24">
        <section aria-labelledby="try-h" className="flex flex-col gap-7">
          <h2 id="try-h" className={H2}>
            Try an act. <span className="text-signal-text">Watch it plan live.</span>
          </h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4 p-0">
            {EXAMPLES.map((example) => (
              <li key={example.id}>
                {/* No prefetch (ExampleActCard): each click makes a new plan link and starts a fresh agent run (presets are inputs only). */}
                <ExampleActCard name={example.label} blurb={example.blurb} soundsLike={example.performer.artists.slice(0, 3).join(", ")} href={`/plan?example=${example.id}`} />
              </li>
            ))}
          </ul>
          <p className="m-0 text-sm text-muted-foreground">
            Or plan a whole week:{" "}
            {EXAMPLES.map((example, i) => (
              <span key={example.id}>
                {i > 0 && " · "}
                <Link className="text-foreground underline underline-offset-3 hover:decoration-2" prefetch={false} href={`/week?example=${example.id}`}>
                  Week: {example.label}
                </Link>
              </span>
            ))}
          </p>
          <p className="m-0 text-sm text-muted-foreground">
            Planning for your own act?{" "}
            <Link className="font-bold text-foreground underline underline-offset-3 hover:decoration-2" href="/busks">
              Plan your busk
            </Link>
            . Played a session? Log your takings in the{" "}
            <Link className="text-foreground underline underline-offset-3 hover:decoration-2" href="/tips">
              tip log
            </Link>
            : it stays in this browser, and pitches where you earn more get a small bonus in your next plans.
          </p>
        </section>

        <section aria-labelledby="who-h" className="flex flex-col gap-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="who-h" className={H2}>
              Busking is <span className="text-signal-text">guesswork</span>
            </h2>
            <Badge variant="estimate">Example data</Badge>
          </div>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4 p-0">
            {PROBLEMS.map(({ icon: Icon, title, guess, fix }) => (
              <li key={title} className="flex flex-col border-2 border-rule bg-card">
                <div className="flex items-center gap-3 px-5 pt-[18px] pb-3.5">
                  <HexCell size={40}>
                    <Icon aria-hidden="true" className="size-[18px]" />
                  </HexCell>
                  <b className="font-display text-[26px] leading-none font-extrabold uppercase">{title}</b>
                </div>
                <div className="flex flex-col gap-1 px-5 pb-4">
                  <span className="font-mono text-[11px] leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase">Guessing</span>
                  <span className="text-[15px] leading-[22px] text-muted-foreground">{guess}</span>
                </div>
                <div className="mt-auto flex flex-col gap-1 border-t-2 border-rule bg-accent px-5 py-4">
                  <span className="font-mono text-[11px] leading-4 font-bold tracking-[0.06em] text-signal-text uppercase">With Busk Map</span>
                  <span className="text-base leading-[23px] font-bold">{fix}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <WhatYouGet />

        <section
          data-theme="dark"
          aria-labelledby="brain"
          data-testid="brain-teaser"
          className="bm-grain flex flex-wrap items-center justify-between gap-8 border-[3px] border-qloo bg-background p-5 text-foreground shadow-[8px_8px_0_var(--qloo)] md:p-10"
        >
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
            <span className="inline-flex items-center gap-2.5 font-mono text-xs leading-4 font-bold tracking-[0.08em] text-muted-foreground uppercase">
              Powered by <QlooWordmark width={72} className="text-foreground" />
            </span>
            <h2 id="brain" className="m-0 font-display text-[clamp(44px,6vw,80px)] leading-[0.9] font-extrabold uppercase">
              The <span className="text-qloo">brain</span> of Busk Map
            </h2>
            <p className="m-0 max-w-xl text-lg leading-[27px]">
              Every Qloo call Busk Map makes, the data it brings back, and the part of your busk it decides. Pick any piece to light up its path.
            </p>
            <StatStrip
              tone="qloo"
              label="Qloo in numbers"
              items={[
                { n: callKinds, label: "kinds of Qloo call" },
                { n: CALLS_PER_NEW_BUSK, label: "calls for a new busk" },
                { n: CALLS_ON_RERUN, label: "on a rerun" },
                { n: featureCount, label: "parts of your plan they decide" },
              ]}
            />
            <Button asChild variant="outline" size="lg" className="self-start">
              <Link href="/brain">
                Open the brain <span aria-hidden="true">→</span>
              </Link>
            </Button>
          </div>
        </section>
        <section data-theme="dark" aria-labelledby="next-h" className="bm-grain flex flex-wrap items-center gap-8 border-[3px] border-rule bg-background p-5 text-foreground md:p-10">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
            <span className="font-mono text-xs leading-4 font-bold tracking-[0.08em] text-signal-text uppercase">Next · not built yet</span>
            <h2 id="next-h" className="m-0 font-display text-[clamp(40px,4.4vw,60px)] leading-[0.92] font-extrabold uppercase">
              Beyond buskers
            </h2>
            <p className="m-0">Busk Map already reads taste, street pitches, permits, foot traffic and the hour. Three things it could place next, with little change.</p>
          </div>
          <ul className="m-0 grid min-w-0 flex-[2_1_520px] list-none grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3 p-0">
            {BEYOND.map((item) => (
              <li key={item.title} className="flex flex-col gap-1.5 border-[1.5px] border-border bg-card p-4">
                <b className="font-display text-xl leading-none font-extrabold uppercase">{item.title}</b>
                <span className="text-sm leading-5 text-muted-foreground">{item.body}</span>
              </li>
            ))}
          </ul>
        </section>

      </div>

      <section data-theme="dark" aria-labelledby="cta-h" className="bm-grain border-t-[6px] border-primary bg-background text-foreground">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-10 px-4 py-16 md:px-6 md:py-24">
          <h2 id="cta-h" className="m-0 font-display text-[clamp(52px,7vw,104px)] leading-[0.88] font-extrabold uppercase">
            Your crowd
            <br />
            <span className="text-signal-text">is out there.</span>
          </h2>
          <Link
            href="/busks"
            className="inline-flex min-h-16 items-center border-2 border-foreground bg-primary px-9 text-xl font-bold text-primary-foreground no-underline bm-poster [--poster-shadow:6px_6px_0_var(--foreground)] hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--foreground))]"
          >
            Plan a busk
          </Link>
        </div>
      </section>

      {/* The lockup, the Qloo credit and the legal line are the site footer (the root layout); the data sources stay here. */}
      <p className="mx-auto m-0 max-w-[1360px] px-4 pt-6 pb-6 text-xs text-muted-foreground md:px-6">
        Data: {[SOURCES.qloo, SOURCES["melbourne-pedestrian"], SOURCES["melbourne-busking"], SOURCES.ticketmaster, SOURCES.lastfm, SOURCES["open-meteo"], SOURCES.spotify, SOURCES.osm].map((s) => s.name).join(" · ")}
      </p>
    </main>
  );
}
