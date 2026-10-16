import Link from "next/link";
import { ExampleActCard } from "@/components/honeycomb/example-act-card";
import { QlooLink } from "@/components/honeycomb/logo";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { Button } from "@/components/ui/button";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { HeroGlow } from "@/components/landing/hero-glow";
import { HeroTasteMap } from "@/components/landing/hero-taste-map";
import { PartnersSection } from "@/components/landing/partners-section";
import { OwnRedirect } from "@/components/landing/own-redirect";
import { Warmup } from "@/components/landing/warmup";
import { ASSET_COUNT, COMPONENT_COUNT } from "@/components/brand/brand-tables";
import { StatStrip } from "@/components/honeycomb/stat-strip";
import { Icon } from "@/components/honeycomb/icon";
import { WhatYouGet } from "@/components/landing/what-you-get";
import { EXAMPLES, exampleWhen, examplePlays } from "@/lib/examples";
import { CALLS_ON_RERUN, CALLS_PER_NEW_BUSK, callKinds } from "@/lib/qloo-map";
import { BrainSketch } from "@/components/honeycomb/brain-sketch";

const H2 = "m-0 font-display text-[clamp(44px,5vw,72px)] leading-[0.92] font-extrabold uppercase";
// The hex lattice behind the hero and the dark bands: a honeycomb in hairlines, one cell wide at 48.5px.
const LATTICE =
  "M24.2 0 L48.5 14 L48.5 42 L24.2 56 L0 42 L0 14Z M0 42 L24.2 56 L24.2 84 L0 98 L-24.2 84 L-24.2 56Z M48.5 42 L72.7 56 L72.7 84 L48.5 98 L24.2 84 L24.2 56Z M24.2 84 L48.5 98 L48.5 126 L24.2 140 L0 126 L0 98Z M0 -42 L24.2 -28 L24.2 0 L0 14 L-24.2 0 L-24.2 -28Z M48.5 -42 L72.7 -28 L72.7 0 L48.5 14 L24.2 0 L24.2 -28Z";

const TICKER = ["Qloo taste map", "Qloo crowd at each pitch", "Qloo venue and event crowds", "Qloo audience age", "foot traffic for your hour", "3 pitches for you"];

const PROBLEMS = [
  { icon: "pin" as const, title: "Where?", guess: "Bourke Street Mall, like every other busker.", fix: "Southbank Promenade: the strongest folk taste area on Qloo." },
  { icon: "clock" as const, title: "When?", guess: "Turn up at noon and hope.", fix: "About 1,900 people an hour, and a matinee lets out at 2:45 pm." },
  { icon: "legal" as const, title: "Allowed?", guess: "The station steps, until a ranger moves you on.", fix: "A general-permit pitch, clear of the no-busking zones." },
  { icon: "music" as const, title: "What to play?", guess: "Wonderwall, again.", fix: "Open with Fast Car: the song this crowd knows best." },
];

const BEYOND = [
  { title: "Every street act", body: "Magicians, living statues, chalk artists: the same pitches, rules and hours, with a routine in place of a suggested set." },
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
        <HeroGlow />
        {/* Full-bleed map (F19): the map half runs to the hero's right edge and from top to bottom, with no frame. */}
        <div className="relative h-[clamp(300px,80vw,460px)] w-full lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-1/2" data-testid="hero-map">
          <HeroTasteMap label="An illustration of Qloo's taste map for a folk duo, with their three pitches" />
        </div>
        <div className="relative mx-auto flex max-w-[1360px] flex-wrap items-start gap-x-14 gap-y-10 px-4 py-12 md:px-6 md:py-16 lg:pointer-events-none">
          {/* The headline sizes itself to its column (19cqw) so "What to play." always stays on one line, as in the deck (B-025). */}
          <div className="flex min-w-0 flex-[1.2_1_520px] flex-col gap-7 pt-4 [container-type:inline-size] md:pt-6 lg:max-w-[calc(50%-28px)] lg:pointer-events-auto">
            <h1 id="hero" className="m-0 font-display text-[min(19cqw,clamp(64px,9vw,136px))] leading-[0.86] font-extrabold uppercase [text-shadow:0_0_18px_var(--background)]">
              <span className="sr-only">Busk Map: </span>
              Where to busk.
              <br />
              When.
              <br />
              <span className="whitespace-nowrap text-signal-text">What to play.</span>
            </h1>
            <Button asChild variant="poster" size="poster-lg" className="w-full justify-between [&_svg:not([class*=size-])]:size-9">
              <Link href="/busks">
                Plan a busk
                <Icon name="arrow-right" size={36} />
              </Link>
            </Button>
          </div>
          <div className="flex basis-full flex-wrap items-center justify-center gap-x-7 gap-y-4 pt-4 text-qloo">
            {/* The halo keeps the purple legible when a glowing cell pulses behind it. */}
            <span className="font-display text-[clamp(26px,5vw,44px)] leading-none font-extrabold tracking-[0.02em] whitespace-nowrap uppercase [text-shadow:0_0_3px_var(--background),0_0_8px_var(--background),0_0_14px_var(--background)]">
              In partnership with
            </span>
            <QlooLink width={160} className="w-[clamp(96px,22vw,160px)]" wordmarkClassName="h-auto w-full text-foreground" />
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
        <figure aria-label="Demo video, coming soon" data-testid="demo-video-slot" className="bm-grain m-0 flex aspect-video max-h-[720px] w-full flex-col items-center justify-center gap-4 border-[3px] border-rule bg-background p-6 text-center text-foreground shadow-md" data-theme="dark">
          <HexCell size={96} tone="primary" fontSize={44}>
            <Icon name="play" size={40} />
          </HexCell>
          <b className="font-display text-[clamp(28px,4vw,44px)] leading-none font-extrabold uppercase">[Demo video · 60–90 s]</b>
          <figcaption className="m-0 max-w-xl font-mono text-xs leading-4 text-muted-foreground">
            A folk duo plans a Sunday busk: Qloo&apos;s taste map fills in, the research runs, the busk appears.
          </figcaption>
        </figure>

        <section aria-labelledby="try-h" className="flex flex-col gap-7">
          <h2 id="try-h" className={H2}>
            Try an act. <span className="text-signal-text">Watch it plan live.</span>
          </h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4 p-0">
            {EXAMPLES.map((example) => (
              <li key={example.id}>
                {/* No prefetch (ExampleActCard): each click makes a new plan link and starts a fresh agent run (presets are inputs only). */}
                <ExampleActCard
                  name={example.label}
                  when={exampleWhen(example)}
                  soundsLike={example.performer.artists.slice(0, 3).join(", ")}
                  plays={examplePlays(example)}
                  href={`/plan?example=${example.id}`}
                />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="who-h" className="flex flex-col gap-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="who-h" className={H2}>
              Busking is <span className="text-signal-text">guesswork</span>
            </h2>
          </div>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4 p-0">
            {PROBLEMS.map(({ icon, title, guess, fix }) => (
              <li key={title} className="flex flex-col border-2 border-rule bg-card">
                <div className="flex items-center gap-3 px-5 pt-[18px] pb-3.5">
                  <HexCell size={40}>
                    <Icon name={icon} size={18} />
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

        <PartnersSection />

        <section
          data-theme="dark"
          aria-labelledby="brain"
          data-testid="brain-teaser"
          className="bm-grain flex flex-wrap items-center justify-between gap-8 border-[3px] border-qloo bg-background p-5 text-foreground shadow-[8px_8px_0_var(--qloo)] md:p-10"
        >
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
            <span className="inline-flex items-center gap-2.5 font-mono text-xs leading-4 font-bold tracking-[0.08em] text-muted-foreground uppercase">
              Powered by <QlooLink width={72} />
            </span>
            <h2 id="brain" className="m-0 font-display text-[clamp(44px,6vw,80px)] leading-[0.9] font-extrabold uppercase">
              The <span className="text-qloo">brain</span> of <br />
              Busk Map
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
              ]}
            />
            <Button asChild variant="poster" size="default" className="h-auto min-h-[52px] self-start gap-2.5 border-foreground bg-qloo px-6 text-lg font-sans font-bold normal-case tracking-normal text-bluestone hover:bg-[color-mix(in_oklab,var(--qloo)_88%,var(--foreground))] shadow-[4px_4px_0_var(--foreground)] hover:shadow-[5px_5px_0_var(--foreground)]">
              <Link href="/brain">
              Open the brain <Icon name="arrow-right" size={20} />
            </Link>
            </Button>
          </div>
          <BrainSketch />
        </section>

        <section
          aria-labelledby="brand-h"
          data-testid="brand-teaser"
          className="flex flex-wrap items-center justify-between gap-8 border-[3px] border-rule bg-card p-5 shadow-[8px_8px_0_var(--primary)] md:p-10"
        >
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
            <span className="font-mono text-xs leading-4 font-bold tracking-[0.08em] text-signal-text uppercase">The brand</span>
            <h2 id="brand-h" className="m-0 font-display text-[clamp(44px,6vw,80px)] leading-[0.9] font-extrabold text-signal-text uppercase">
              Honeycomb
            </h2>
            <p className="m-0 max-w-xl text-lg leading-[27px]">
              Busk Map dresses like a street poster: one honeycomb idea, signal orange on night and paper, and type you can read from across the street. Every
              screen here is built from one published design system.
            </p>
            <StatStrip
              label="The brand in numbers"
              items={[
                { n: COMPONENT_COUNT, label: "components" },
                { n: 3, label: "typefaces" },
                { n: ASSET_COUNT, label: "assets" },
              ]}
            />
            <Button asChild variant="poster" size="default" className="h-auto min-h-[52px] self-start gap-2.5 border-rule px-6 text-lg font-sans font-bold normal-case tracking-normal shadow-[4px_4px_0_var(--foreground)] hover:shadow-[5px_5px_0_var(--foreground)]">
              <Link href="/brand">
              See the brand <Icon name="arrow-right" size={20} />
            </Link>
            </Button>
          </div>
          <div aria-hidden="true" className="box-border flex max-w-full min-w-0 flex-[0_1_340px] flex-col gap-3 border-2 border-rule bg-secondary p-4">
            <div className="flex items-center gap-3">
              <HexCell size={36} tone="primary" fontSize={16}>
                1
              </HexCell>
              <PercentCell value={91} size={44} label="" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px] leading-3 text-muted-foreground">
              {[
                ["Signal orange", "bg-primary"],
                ["Bluestone", "bg-bluestone"],
                ["Paper", "bg-background"],
              ].map(([name, c]) => (
                <span key={name} className="flex flex-col gap-1">
                  <i className={`block h-9 border-2 border-rule ${c}`} />
                  {name}
                </span>
              ))}
            </div>
            <div className="flex flex-col">
              <b className="font-display text-3xl leading-none font-extrabold uppercase">Big Shoulders</b>
              <b className="text-base">Atkinson Hyperlegible Next</b>
              <span className="font-mono text-sm text-muted-foreground">JetBrains Mono</span>
            </div>
          </div>
        </section>

      </div>

      <section data-theme="dark" aria-labelledby="cta-h" className="bm-grain border-t-[6px] border-primary bg-background text-foreground">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-10 px-4 py-16 md:px-6 md:py-24">
          <h2 id="cta-h" className="m-0 font-display text-[clamp(52px,7vw,104px)] leading-[0.88] font-extrabold uppercase">
            Your crowd
            <br />
            <span className="text-signal-text">is out there.</span>
          </h2>
          <Button asChild variant="poster">
              <Link href="/busks">
            Plan a busk
          </Link>
            </Button>
        </div>
      </section>

    </main>
  );
}
