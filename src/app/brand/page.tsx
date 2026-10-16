import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, ExternalLink, MapPin, Music } from "lucide-react";
import { BrandChoiceDemo, BrandSlotDemo } from "@/components/brand/brand-demos";
import { PhoneFold } from "@/components/brand/phone-fold";
import { Banner } from "@/components/honeycomb/banner";
import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { EvidenceLine } from "@/components/honeycomb/evidence-line";
import { ExampleActCard } from "@/components/honeycomb/example-act-card";
import { FormMessage } from "@/components/honeycomb/form-message";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { LeanBar } from "@/components/honeycomb/lean-bar";
import { Logo } from "@/components/honeycomb/logo";
import { NoteCard } from "@/components/honeycomb/note-card";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";
import { StatStrip } from "@/components/honeycomb/stat-strip";
import { StatusCard } from "@/components/status/status-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DURATIONS, EASINGS, RADII, SHADOWS, SIZES, SPACE, STROKES, TOKENS, WORDS, type ScaleRow } from "@/lib/brand-data";

export const metadata: Metadata = {
  title: "Brand · Busk Map",
  description: "Honeycomb, the Busk Map brand: the idea, the words, the colours, type and components, and every logo and social asset.",
};

const H2 = "m-0 font-display text-[clamp(40px,6vw,56px)] leading-none font-extrabold uppercase";
const H3 = "m-0 font-display text-[30px] leading-none font-extrabold uppercase";
const CARD = "flex min-w-0 flex-col gap-2.5 border-2 border-rule bg-card p-5";
const GRID = "grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3";
const MONO = "font-mono text-xs leading-[18px] font-medium";

/** "Plain `code` text": backtick pairs become <code>. */
function Rich({ children }: { children: string }) {
  return (
    <>
      {children.split("`").map((part, i) => (i % 2 ? <code key={i} className="font-mono text-[0.9em]">{part}</code> : part))}
    </>
  );
}

function Section({ id, n, title, intro, children }: { id: string; n: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-6 flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <span className="font-mono text-xs leading-4 font-bold tracking-[0.08em] text-signal-text uppercase">{n}</span>
        <h2 id={`${id}-h`} className={H2}>
          {title}
        </h2>
        {intro ? <p className="m-0 max-w-3xl text-lg leading-[27px]">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A table that scrolls inside its own ruled frame (and can be scrolled from the keyboard). */
function TableFrame({ label, children, min = 640 }: { label: string; children: ReactNode; min?: number }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto border-2 border-rule bg-card">
      <table className="w-full border-collapse text-left text-sm leading-5" style={{ minWidth: min }}>
        {children}
      </table>
    </div>
  );
}
const TH = "border-b border-border px-3 py-2 font-mono text-[11px] leading-4 font-bold tracking-[0.08em] text-muted-foreground uppercase";
const TD = "border-b border-border px-3 py-2 align-top";

function Scale({ title, rows }: { title: string; rows: ScaleRow[] }) {
  return (
    <>
      <b>{title}</b>
      {rows.map((r) => (
        <span key={r.name} className={MONO}>
          <b>{r.name}</b> {r.value} · <Rich>{r.use}</Rich>
        </span>
      ))}
    </>
  );
}

const PRINCIPLES = [
  ["The pitch ring", "An open circle (the crowd) around one paper cell (the performer), in an orange honeycomb cell. It is the logo, the loader, every map pin and the score ring."],
  ["One thing, one cell", "Anything that stands for one thing (a place, a rank, a song, a score, a step) is a pointy-top hexagon. Anything that holds things stays a square box."],
  ["Signal orange", "The one loud colour: the next action, rank cells, the score. It is a fill; `signal-text` is orange you can read."],
  ["Bluestone and paper", "Bluestone is the ink and the night ground; warm paper is the day ground. Both themes pass AA everywhere."],
  ["Condensed caps", "Big Shoulders shouts the headings. Sentences stay in Atkinson Hyperlegible Next; data and numbers in JetBrains Mono."],
  ["Print texture", "2px rules instead of soft shadows, hard offsets on things that float, a halftone grain on night grounds, a stencil wordmark."],
  ["Qloo, our partner", "Qloo is credited with its own wordmark wherever its data changes the answer, and has its own purple (`qloo`) only for Qloo facts and the Brain."],
  ["Honest numbers", "Every number names its source. Estimates are labelled; planned work is labelled \"Next · not built yet\"; nothing is invented."],
] as const;

const VOICE = [
  ["Pitch, busk", "A pitch is one place to play. A busk is the whole outing: three pitches, their setlists, one link."],
  ["Plain words", "Say what the research found, never the tool behind it. Raw data waits behind its toggle."],
  ["Honest numbers", "Every number names its source. Estimates are labelled, and nothing is invented."],
  ["Qloo first", "Taste data is the heart of every busk. Credit Qloo wherever its data changed the answer."],
] as const;

const COLOURS = [
  ["Signal orange", "--primary", "actions, top pick"],
  ["Bluestone", "--bluestone", "ink, night ground"],
  ["Paper", "--card", "cards, panels"],
  ["Ground", "--background", "the page"],
  ["Honey", "--honey", "hidden gems"],
  ["Qloo", "--qloo", "Qloo, our partner"],
  ["Event blue", "--event", "events"],
  ["Zone pink", "--zone-pink", "no-busking zones"],
  ["Footfall", "--footfall", "foot traffic"],
] as const;

type Asset = { name: string; src: string; alt: string; w: number; h: number; dark?: boolean };
const ASSET_GROUPS: { name: string; min: string; files: Asset[] }[] = [
  {
    name: "Logos",
    min: "220px",
    files: [
      { name: "busk-map-lockup-light.svg", src: "/brand/busk-map-lockup-light.svg", alt: "Busk Map lockup for light grounds", w: 256, h: 48 },
      { name: "busk-map-lockup-dark.svg", src: "/brand/busk-map-lockup-dark.svg", alt: "Busk Map lockup for dark grounds", w: 256, h: 48, dark: true },
      { name: "busk-map-mark-light.svg", src: "/brand/busk-map-mark-light.svg", alt: "Busk Map mark for light grounds", w: 64, h: 64 },
      { name: "busk-map-mark-dark.svg", src: "/brand/busk-map-mark-dark.svg", alt: "Busk Map mark for dark grounds", w: 64, h: 64, dark: true },
      { name: "busk-map-wordmark-light.svg", src: "/brand/busk-map-wordmark-light.svg", alt: "Busk Map wordmark for light grounds", w: 241, h: 39 },
      { name: "busk-map-wordmark-dark.svg", src: "/brand/busk-map-wordmark-dark.svg", alt: "Busk Map wordmark for dark grounds", w: 241, h: 39, dark: true },
    ],
  },
  {
    name: "Favicon and app icons",
    min: "180px",
    files: [
      { name: "favicon.svg", src: "/brand/favicon/favicon.svg", alt: "Favicon", w: 48, h: 48 },
      { name: "favicon-32.png", src: "/brand/favicon/favicon-32.png", alt: "Favicon, 32 pixels", w: 32, h: 32 },
      { name: "apple-touch-icon-180.png", src: "/brand/favicon/apple-touch-icon-180.png", alt: "Apple touch icon", w: 96, h: 96 },
      { name: "app-icon-512.png", src: "/brand/favicon/app-icon-512.png", alt: "App icon, 512 pixels", w: 96, h: 96 },
    ],
  },
  {
    name: "Social and Devpost",
    min: "320px",
    files: [
      { name: "og-image-1200x630.png", src: "/brand/social/og-image-1200x630.png", alt: "Open Graph image", w: 1200, h: 630 },
      { name: "devpost-cover-1200x800.png", src: "/brand/social/devpost-cover-1200x800.png", alt: "Devpost cover", w: 1200, h: 800 },
      { name: "devpost-thumbnail-512.png", src: "/brand/social/devpost-thumbnail-512.png", alt: "Devpost thumbnail", w: 512, h: 512 },
      { name: "social-banner-1500x500.png", src: "/brand/social/social-banner-1500x500.png", alt: "Social banner", w: 1500, h: 500 },
    ],
  },
  {
    name: "GitHub and README",
    min: "320px",
    files: [
      { name: "github-social-preview-1280x640.png", src: "/brand/kit/github-social-preview-1280x640.png", alt: "GitHub social preview", w: 1280, h: 640 },
      { name: "readme-hero-1600x640.png", src: "/brand/kit/readme-hero-1600x640.png", alt: "README hero", w: 1600, h: 640 },
    ],
  },
  {
    name: "Video kit",
    min: "320px",
    files: [
      { name: "video-title-1920x1080.png", src: "/brand/kit/video-title-1920x1080.png", alt: "Video title card", w: 1920, h: 1080 },
      { name: "video-end-1920x1080.png", src: "/brand/kit/video-end-1920x1080.png", alt: "Video end card", w: 1920, h: 1080 },
      { name: "video-lower-third-1920x1080.png", src: "/brand/kit/video-lower-third-1920x1080.png", alt: "Video lower third", w: 1920, h: 1080 },
    ],
  },
  {
    name: "Screenshots",
    min: "320px",
    files: [
      { name: "screenshot-desktop-1500x1000.png", src: "/brand/kit/screenshot-desktop-1500x1000.png", alt: "Desktop screenshot", w: 1500, h: 1000 },
      { name: "screenshot-phone-1500x1000.png", src: "/brand/kit/screenshot-phone-1500x1000.png", alt: "Phone screenshot", w: 1500, h: 1000 },
    ],
  },
];

/** The brand page: a public, static showcase of the Honeycomb brand with the app's real components. */
export default function BrandPage() {
  return (
    <main id="main" className="flex-1">
      <section data-theme="dark" aria-labelledby="brand-h" className="bm-grain border-b-[6px] border-primary bg-background text-foreground">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-10 px-4 py-12 md:px-6 md:py-16">
          <div className="flex min-w-0 max-w-3xl flex-col gap-4">
            <span className="font-mono text-[13px] leading-4 font-bold tracking-[0.08em] text-signal-text uppercase">Busk Map brand · design system v62</span>
            <h1 id="brand-h" className="m-0 font-display text-[clamp(64px,12vw,144px)] leading-[0.86] font-extrabold uppercase">
              Honey<span className="text-signal-text">comb</span>
            </h1>
            <p className="m-0 text-[19px] leading-[29px]">
              The brand and design system Busk Map is built from: the idea, the words, the colours and type, the components as they render in the app, and every logo and social asset.
            </p>
            <nav aria-label="On this page" className="flex flex-wrap gap-x-4.5 gap-y-2 font-mono text-sm leading-5 font-bold">
              {[
                ["#book", "Brand book"],
                ["#words", "Words"],
                ["#foundations", "Foundations"],
                ["#tokens", "Tokens"],
                ["#components", "Components"],
                ["#assets", "Assets"],
              ].map(([href, label]) => (
                <a key={href} href={href} className="flex min-h-tap items-center text-signal-text underline underline-offset-3 hover:decoration-2">
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <Logo variant="lockup" size={64} className="text-foreground" />
        </div>
      </section>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-16 px-4 pt-12 pb-24 md:gap-24 md:px-6 md:pt-[72px]">
        <Section
          id="book"
          n="01"
          title="Brand book"
          intro={
            <>
              Busk Map tells street performers where and when to play, and what to play there. It is used standing on a footpath, phone in one hand, in bright sun or after dark. <b>Honeycomb</b> is a street poster you can plan with, built from one shape: the honeycomb cell from Qloo&apos;s taste map.
            </>
          }
        >
          <PhoneFold heading="Principles" count={PRINCIPLES.length} headingClassName="sr-only">
            <ul className={`${GRID} m-0 list-none p-0`}>
              {PRINCIPLES.map(([title, body]) => (
                <li key={title} className={CARD}>
                  <b className="font-display text-2xl leading-none font-extrabold uppercase">{title}</b>
                  <span>
                    <Rich>{body}</Rich>
                  </span>
                </li>
              ))}
            </ul>
          </PhoneFold>
          <PhoneFold heading="Voice" headingClassName={H3}>
            <ul className={`${GRID} m-0 list-none p-0`}>
              {VOICE.map(([title, body]) => (
                <li key={title} className={CARD}>
                  <b>{title}</b>
                  <span>{body}</span>
                </li>
              ))}
            </ul>
          </PhoneFold>
        </Section>

        <Section id="words" n="02" title="The words" intro="Use these words, in these senses, everywhere: UI, docs, video and social. No tool names in the UI.">
          <PhoneFold heading="The word list" count={WORDS.length} headingClassName="sr-only">
          <TableFrame label="The words" min={520}>
            <thead>
              <tr>
                <th scope="col" className={`${TH} w-[220px]`}>
                  Word
                </th>
                <th scope="col" className={TH}>
                  Means
                </th>
              </tr>
            </thead>
            <tbody>
              {WORDS.map((w) => (
                <tr key={w.t}>
                  <th scope="row" className={`${TD} text-left font-bold whitespace-nowrap`}>
                    {w.t}
                  </th>
                  <td className={TD}>{w.b}</td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
          </PhoneFold>
        </Section>

        <Section id="foundations" n="03" title="Foundations">
          <PhoneFold heading="Colour" headingClassName={H3}>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-0">
              {COLOURS.map(([name, token, use]) => (
                <li key={token} className="flex flex-col border-2 border-rule bg-card">
                  <span aria-hidden="true" className="h-[72px] border-b-2 border-rule" style={{ background: `var(${token})` }} />
                  <span className="flex flex-col gap-0.5 px-2.5 py-2">
                    <b>{name}</b>
                    <span className="font-mono text-[11px] leading-[15px] text-muted-foreground">
                      {token} · {use}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div role="img" aria-label="Taste ramp from low to high Qloo affinity, five steps" className="grid h-9 grid-cols-5 border-2 border-rule">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} style={{ background: `var(--taste-${n})` }} />
              ))}
            </div>
            <span className="font-mono text-xs leading-4 text-muted-foreground">Taste ramp: --taste-1 to --taste-5, low to high Qloo affinity. Every colour has a night value.</span>
          </PhoneFold>

          <PhoneFold heading="Type" headingClassName={H3}>
            <div className={GRID}>
              <div className={CARD}>
                <span className="font-display text-[56px] leading-[0.9] font-extrabold uppercase">Southbank</span>
                <b>Big Shoulders 800</b>
                <span className="text-sm text-muted-foreground">--font-display · headlines and pitch names, in capitals</span>
              </div>
              <div className={CARD}>
                <span className="text-xl leading-7">Folk crowd; a matinee lets out at 2:45 pm.</span>
                <b>Atkinson Hyperlegible Next</b>
                <span className="text-sm text-muted-foreground">--font-sans · everything people read</span>
              </div>
              <div className={CARD}>
                <span className="font-mono text-lg leading-[26px] font-medium">SUN 19 OCT · 12–3 PM</span>
                <b>JetBrains Mono</b>
                <span className="text-sm text-muted-foreground">--font-mono · times, counts, sources, labels</span>
              </div>
            </div>
          </PhoneFold>

          <PhoneFold heading="The honeycomb" headingClassName={H3}>
            <p className="m-0 max-w-3xl">One idea per pointy-top cell: a rank, a person, a song or a score. Never a circle or a square tile. Every 0–100 value is a PercentCell.</p>
            <div className="flex flex-wrap items-center gap-4.5 border-2 border-rule bg-card p-5">
              <HexCell size={56} fontSize={24} tone="primary">1</HexCell>
              <HexCell size={56} fontSize={20}>GW</HexCell>
              <HexCell size={56} tone="muted"><Music className="size-6" aria-hidden="true" /></HexCell>
              <HexCell size={56} tone="error"><MapPin className="size-6" aria-hidden="true" /></HexCell>
              <PercentCell value={91} size={56} label="Score" />
              <PercentCell value={64} size={56} label="Taste match" />
              <PercentCell value={null} size={56} label="Score" />
              <RankTile n={2} />
            </div>
          </PhoneFold>

          <PhoneFold heading="Space, size, shape and motion" headingClassName={H3}>
            <div className={GRID}>
              <div className={CARD}><Scale title="Spacing (4px base)" rows={SPACE} /></div>
              <div className={CARD}><Scale title="Sizes" rows={SIZES} /></div>
              <div className={CARD}>
                <Scale title="Shape: square, ruled" rows={RADII} />
                <Scale title="Strokes" rows={STROKES} />
              </div>
              <div className={CARD}><Scale title="Elevation: hard offsets, no blur" rows={SHADOWS} /></div>
              <div className={CARD}>
                <Scale title="Motion: explains, never decorates" rows={DURATIONS} />
                <Scale title="Easing" rows={EASINGS} />
                <span className={MONO}>Under prefers-reduced-motion, everything drops to 0 ms except progress.</span>
              </div>
            </div>
          </PhoneFold>
        </Section>

        <Section
          id="tokens"
          n="04"
          title="Tokens → shadcn"
          intro={
            <>
              The colour names are shadcn/ui theme variables one-to-one, so every shadcn component picks up Honeycomb from <code className="font-mono text-[0.9em]">globals.css</code> alone. Busk Map&apos;s map, data and brand tokens sit on top. Every text pair passes 4.5:1 and every mark 3:1, in both themes.
            </>
          }
        >
          <PhoneFold heading="Colour tokens, day and night" count={TOKENS.length} headingClassName="sr-only">
          <TableFrame label="Colour tokens, day and night" min={860}>
            <thead>
              <tr>
                <th scope="col" className={TH}>Token</th>
                <th scope="col" className={TH}>Layer</th>
                <th scope="col" className={TH}>Day</th>
                <th scope="col" className={TH}>Night</th>
                <th scope="col" className={TH}>Use</th>
              </tr>
            </thead>
            <tbody>
              {TOKENS.map((t) => (
                <tr key={t.name}>
                  <th scope="row" className={`${TD} text-left font-mono text-xs font-bold whitespace-nowrap`}>--{t.name}</th>
                  <td className={`${TD} ${MONO}`}>{t.kind}</td>
                  <td className={`${TD} ${MONO} whitespace-nowrap`}>
                    <span aria-hidden="true" className="mr-1.5 inline-block h-5 w-7 border-[1.5px] border-rule align-middle" style={{ background: t.lightSw }} />
                    {t.light}
                  </td>
                  <td className={`${TD} ${MONO} whitespace-nowrap`}>
                    <span aria-hidden="true" className="mr-1.5 inline-block h-5 w-7 border-[1.5px] border-rule align-middle" style={{ background: t.darkSw }} />
                    {t.dark}
                  </td>
                  <td className={TD}><Rich>{t.use}</Rich></td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
          </PhoneFold>
        </Section>

        <Section id="components" n="05" title="Components" intro="The same components the app renders, live: nothing here is a picture. Switch your system to night to see the other theme.">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
            <PhoneFold heading="Buttons" headingClassName="font-display text-[22px] leading-none font-extrabold uppercase" wideClassName={`${CARD} gap-3.5`}>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button>Plan my busk <ArrowRight aria-hidden="true" /></Button>
                <Button variant="outline">Week</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Cancel</Button>
                <Button variant="destructive">Delete</Button>
                <Button variant="link">A link button</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-input">Act name</Label>
                <Input id="brand-input" placeholder="e.g. Jess on acoustic guitar" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-input-err">Act name, with an error</Label>
                <Input id="brand-input-err" aria-invalid="true" aria-describedby="brand-input-err-m" defaultValue="A very long act name" />
                <FormMessage tone="error" id="brand-input-err-m" alert={false}>Act name: use 80 characters or fewer.</FormMessage>
              </div>
            </PhoneFold>

            <PhoneFold heading="Badges and status" headingClassName="font-display text-[22px] leading-none font-extrabold uppercase" wideClassName={`${CARD} gap-3.5`}>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">Neutral</Badge>
                <Badge variant="solid">Your song</Badge>
                <DiscoveryBadge discovery="hidden-gem" />
                <DiscoveryBadge discovery="usual" />
                <Badge variant="legal">Permit pitch</Badge>
                <Badge variant="restricted">Restricted</Badge>
                <Badge variant="event">Event</Badge>
                <Badge variant="weather">Weather</Badge>
                <Badge variant="footfall">Foot traffic</Badge>
                <Badge variant="estimate">Example data</Badge>
                <Badge variant="destructive">Error</Badge>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <DataStatusBadge status="live" source="Qloo" />
                <DataStatusBadge status="cached" source="Weather" />
                <DataStatusBadge status="test" source="Qloo" />
                <DataStatusBadge status="estimated" source="Foot traffic" />
                <DataStatusBadge status="unavailable" source="Events" reason="no answer" />
              </div>
              <FormMessage>Loading your songs from Spotify…</FormMessage>
              <FormMessage tone="error" alert={false}>Pick today or a later date.</FormMessage>
              <FormMessage tone="success">Logged A$85 at Hardware Lane.</FormMessage>
            </PhoneFold>

            <PhoneFold heading="Alerts and banners" headingClassName="font-display text-[22px] leading-none font-extrabold uppercase" wideClassName={`${CARD} gap-3.5`}>
              <Alert variant="info"><AlertTitle>Info</AlertTitle><AlertDescription>Planning again for The Larkspur Two.</AlertDescription></Alert>
              <Alert variant="warning"><AlertTitle>The city&apos;s sensors didn&apos;t answer</AlertTitle><AlertDescription>Foot traffic is estimated and marked &quot;est.&quot;.</AlertDescription></Alert>
              <Alert variant="error"><AlertTitle>Plan limit reached</AlertTitle><AlertDescription>No new plan was started.</AlertDescription></Alert>
              <Alert variant="estimate"><AlertTitle>Estimate</AlertTitle><AlertDescription>This number is modelled, not measured.</AlertDescription></Alert>
              <Banner tone="test">Test data: nothing here is a real pitch.</Banner>
              <Banner tone="less">Less data for this city: some sources are missing.</Banner>
            </PhoneFold>

            <PhoneFold heading="Choice cards and toggles" headingClassName="font-display text-[22px] leading-none font-extrabold uppercase" wideClassName={`${CARD} gap-4`}>
              <BrandChoiceDemo />
              <BrandSlotDemo />
            </PhoneFold>

            <PhoneFold heading="Numbers" headingClassName="font-display text-[22px] leading-none font-extrabold uppercase" wideClassName={`${CARD} gap-4`}>
              <div className="flex flex-wrap items-center gap-4">
                <PercentCell value={91} size={64} label="Score" tone="primary" />
                <PercentCell value={64} size={48} label="Affinity" />
                <PercentCell value={null} size={48} label="Score" />
                <RankTile n={1} size="lg" />
                <RankTile n={4} quiet />
              </div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                <LeanBar label="Age 25–34" lean={0.41} />
                <LeanBar label="Age 55+" lean={-0.3} />
              </ul>
              <StatStrip tone="qloo" label="Qloo in numbers" items={[{ n: 11, label: "kinds of Qloo call" }, { n: "0", label: "on a rerun" }]} />
              <EvidenceLine>Qloo insights: the strongest folk taste area in your slot.</EvidenceLine>
            </PhoneFold>

            <PhoneFold heading="Cards" headingClassName="font-display text-[22px] leading-none font-extrabold uppercase" wideClassName={`${CARD} gap-4`}>
              <ExampleActCard name="Folk duo" blurb="Two voices, guitar and banjo. Sunday afternoon." soundsLike="Gillian Welch" href="/brand#components" />
              <NoteCard variant="next">Taste from genres as well as artists</NoteCard>
              <NoteCard title="A note">Short, titled, in a hairline frame.</NoteCard>
            </PhoneFold>

            <PhoneFold heading="StatusCard" headingClassName="font-display text-[22px] leading-none font-extrabold uppercase" wideClassName={`${CARD} gap-4`}>
              <StatusCard embedded testId="brand-status-notfound" title="No pitch here" description="This page doesn't exist." actions={<Button asChild variant="outline"><Link href="/">Busk Map home</Link></Button>} footnote="Reference: a1b2c3" />
            </PhoneFold>
          </div>
        </Section>

        <Section
          id="assets"
          n="06"
          title="Assets"
          intro="The Hive mark: the pitch ring around one paper-coloured cell, inside a signal-orange cell. One inner cell only; clear space is a quarter of the tile on every side; the lockup is never under 24 px high. Every file below is in public/brand."
        >
          {ASSET_GROUPS.map((group) => (
            <PhoneFold key={group.name} heading={group.name} count={group.files.length} headingClassName="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
              <ul className="m-0 grid list-none gap-3 p-0" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${group.min}, 100%), 1fr))` }}>
                {group.files.map((file) => (
                  <li key={file.name} className="flex min-w-0 flex-col border-2 border-rule bg-card">
                    <span className={`flex min-h-[120px] items-center justify-center border-b-2 border-rule p-5 ${file.dark ? "bg-bluestone" : "bg-card"}`}>
                      <Image src={file.src} alt={file.alt} width={file.w} height={file.h} unoptimized className="block h-auto max-h-[200px] w-auto max-w-full object-contain" />
                    </span>
                    <span className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <span className="font-mono text-xs leading-4 break-all">{file.name}</span>
                      <a href={file.src} download className="inline-flex min-h-tap items-center gap-1 font-mono text-[13px] leading-4 font-bold whitespace-nowrap underline underline-offset-3 hover:decoration-2">
                        Open file
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </PhoneFold>
          ))}
          <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
            <Check aria-hidden="true" className="size-4" />
            Busk Map is open source (MIT). The brand files are in the repository under public/brand.
          </p>
        </Section>
      </div>
    </main>
  );
}
