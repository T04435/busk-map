import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ComponentGroups, PlanStates } from "@/components/brand/brand-components";
import { IconGrid } from "@/components/brand/brand-icons";
import { ASSET_GROUPS, COMPONENT_COUNT, KIT, SCREENS } from "@/components/brand/brand-tables";
import { PhoneFold } from "@/components/brand/phone-fold";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { Spinner } from "@/components/ui/spinner";
import { Logo, QlooWordmark } from "@/components/honeycomb/logo";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";
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
    <div role="region" aria-label={label} tabIndex={0} className="relative overflow-x-auto border-2 border-rule bg-card">
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
  ["Pitch, busk", "A pitch is one place to play. A busk is the whole outing: three pitches, their suggested sets, one link."],
  ["Plain words", "Say what the research found, never the tool behind it."],
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
  ["Footfall", "--footfall", "activity estimate"],
] as const;

/** The brand page: a public, static showcase of the Honeycomb brand with the app's real components. */
export default function BrandPage() {
  return (
    <main id="main" className="flex-1">
      <section data-theme="dark" aria-labelledby="brand-h" className="bm-grain border-b-[6px] border-primary bg-background text-foreground">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-10 px-4 py-12 md:px-6 md:py-16">
          <div className="flex min-w-0 max-w-3xl flex-col gap-4">
            <span className="font-mono text-[13px] leading-4 font-bold tracking-[0.08em] text-signal-text uppercase">Busk Map design deck · design system v66</span>
            <h1 id="brand-h" className="m-0 font-display text-[clamp(64px,12vw,144px)] leading-[0.86] font-extrabold uppercase">
              Honey<span className="text-signal-text">comb</span>
            </h1>
            <p className="m-0 text-[19px] leading-[29px]">
              The brand and design system Busk Map is built from. Enough for a studio to build the whole app from this deck alone: the brand book, the words, tokens mapped to shadcn, every component in every state, every screen, all the assets, and a code handoff.
            </p>
            <nav aria-label="On this page" className="flex flex-wrap gap-x-4.5 gap-y-2 font-mono text-sm leading-5 font-bold">
              {[
                ["#book", "Brand book"],
                ["#words", "Words"],
                ["#foundations", "Foundations"],
                ["#tokens", "Tokens to shadcn"],
                ["#components", "Components"],
                ["#screens", "Screens"],
                ["#assets", "Assets"],
                ["#handoff", "Handoff"],
              ].map(([href, label]) => (
                <a key={href} href={href} className="flex min-h-tap items-center text-signal-text underline underline-offset-3 hover:decoration-2">
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <Logo size={56} />
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
                  {title === "Qloo, our partner" ? <QlooWordmark width={96} className="self-start" /> : null}
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
                <b>Big Shoulders Display 800</b>
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
            <p className="m-0 max-w-3xl">One idea per pointy-top cell: a rank, a person, a song or a score. Never a circle or a square tile. Every 0–100 value is a ScoreCell; a cell that is waiting is dashed.</p>
            <div className="flex flex-wrap items-center gap-4.5 border-2 border-rule bg-card p-5">
              <HexCell size={56} fontSize={24} tone="primary">1</HexCell>
              <HexCell size={56} fontSize={20}>GW</HexCell>
              <HexCell size={56} tone="muted"><Icon name="music" size={24} /></HexCell>
              <HexCell size={56} tone="error"><Icon name="warning" size={24} /></HexCell>
              <ScoreCell value={91} size="lg" label="Score" />
              <ScoreCell value={64} size="lg" label="Taste match" />
              <ScoreCell value={null} size="lg" label="Score" />
              <span className="inline-flex items-center gap-2 text-sm"><HexCell size={56} tone="dashed"><Spinner size={22} label="Working" /></HexCell>Working</span>
              <RankTile n={2} />
            </div>
          </PhoneFold>

          <PhoneFold heading="Iconography" headingClassName={H3}>
            <p className="m-0 max-w-3xl">One icon set, 24px grid, 2px stroke, round caps and joins. Icons come with a word beside them; they never carry meaning alone.</p>
            <IconGrid />
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
          title="Tokens to shadcn"
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
                  <td className={`${TD} ${MONO} w-[170px] max-w-[170px] break-words`}>
                    <span aria-hidden="true" className="mr-1.5 inline-block h-5 w-7 border-[1.5px] border-rule align-middle" style={{ background: t.lightSw }} />
                    {t.light}
                  </td>
                  <td className={`${TD} ${MONO} w-[170px] max-w-[170px] break-words`}>
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

        <Section
          id="components"
          n="05"
          title="Components"
          intro={`${COMPONENT_COUNT} reusable components in the design system, grouped by where they live in the app.`}
        >
          <ComponentGroups />
          <PlanStates />
        </Section>

        <Section id="screens" n="06" title="Screens" intro="Every screen of the app, with the route it lives at.">
          <PhoneFold heading="The screens" count={SCREENS.length} headingClassName="sr-only">
            <TableFrame label="Screens" min={840}>
              <thead>
                <tr>
                  <th scope="col" className={TH}>Screen</th>
                  <th scope="col" className={TH}>Route</th>
                  {["390", "768", "1440"].map((w) => (
                    <th key={w} scope="col" className={`${TH} text-center`}>{w}</th>
                  ))}
                  <th scope="col" className={TH}>What it shows</th>
                </tr>
              </thead>
              <tbody>
                {SCREENS.map((r) => (
                  <tr key={r.name}>
                    <th scope="row" className={`${TD} text-left font-bold`}>{r.name}</th>
                    <td className={`${TD} ${MONO} break-all`}>
                      {r.route.startsWith("/") && !/[<?]/.test(r.route) ? <Link href={r.route} className="underline underline-offset-3 hover:decoration-2">{r.route}</Link> : r.route}
                    </td>
                    {["390", "768", "1440"].map((w) => (
                      <td key={w} className={`${TD} ${MONO} text-center`}>
                        {r.drawn === false ? (
                          <span className="text-muted-foreground">Not yet<span className="sr-only"> drawn at {w}</span></span>
                        ) : (
                          <Icon name="check" size={16} strokeWidth={2.5} label={`Drawn at ${w}`} />
                        )}
                      </td>
                    ))}
                    <td className={TD}>{r.shows}</td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
          </PhoneFold>
        </Section>

        <Section
          id="assets"
          n="07"
          title="Assets"
          intro="The logo is the hex mark beside the Busk Map wordmark, one file for light grounds and one for dark. The mark alone is only for icon sizes: the pitch ring around one paper-coloured cell, inside a signal-orange cell, with a quarter of the tile as clear space; the logo is never under 24 px high. Every file below is in public/brand."
        >
          {ASSET_GROUPS.map((group) => (
            <PhoneFold key={group.name} heading={group.name} count={group.files.length} headingClassName="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
              <ul className="m-0 grid list-none gap-3 p-0" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${group.min}, 100%), 1fr))` }}>
                {group.files.map((file) => (
                  <li key={file.name} className="flex min-w-0 flex-col border-2 border-rule bg-card">
                    <span className={`flex min-h-[120px] items-center justify-center border-b-2 border-rule p-5 ${file.dark ? "bg-bluestone" : "bg-card"}`}>
                      <Image src={file.src} alt={file.alt} width={file.w} height={file.h} unoptimized className="block h-auto max-h-[200px] w-auto max-w-full object-contain" />
                    </span>
                    <span className="flex flex-col gap-1 px-3 py-2.5">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs leading-4 break-all">{file.name}</span>
                        <a href={file.src} download={file.name} aria-label={`Download ${file.name}`} className="inline-flex min-h-tap items-center gap-1 font-mono text-[13px] leading-4 font-bold whitespace-nowrap underline underline-offset-3 hover:decoration-2">
                          Download
                          <Icon name="download" size={14} />
                        </a>
                      </span>
                      {file.note ? <span className="text-xs text-muted-foreground">{file.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </PhoneFold>
          ))}
          <PhoneFold heading="Qloo's logo" headingClassName="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
            <div className="flex flex-wrap items-center gap-4 border-2 border-rule bg-card p-5">
              <QlooWordmark width={160} />
              <span className="max-w-md text-sm text-muted-foreground">Qloo&apos;s own logo, shown wherever Busk Map names Qloo as its partner. It always links to qloo.com in a new tab.</span>
            </div>
          </PhoneFold>
          <PhoneFold heading="Submission and video kit" count={KIT.length} headingClassName="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
            <p className="m-0 max-w-3xl">The pictures for the repository, the Devpost page and the video. Each uses the logo and Qloo&apos;s logo as drawn here; the screenshots are real captures of the app at 1440 and 390.</p>
            <TableFrame label="Submission and video kit" min={640}>
              <thead>
                <tr>
                  <th scope="col" className={TH}>Asset</th>
                  <th scope="col" className={TH}>Size</th>
                  <th scope="col" className={TH}>File</th>
                </tr>
              </thead>
              <tbody>
                {KIT.map((k) => (
                  <tr key={k.file}>
                    <th scope="row" className={`${TD} text-left font-bold`}>{k.name}</th>
                    <td className={`${TD} ${MONO} whitespace-nowrap`}>{k.size}</td>
                    <td className={`${TD} ${MONO}`}>
                      <a href={k.src} download={k.file} className="inline-flex min-h-tap items-center gap-1 break-all underline underline-offset-3 hover:decoration-2">
                        {k.file}
                        <Icon name="download" size={14} className="shrink-0" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
          </PhoneFold>
          <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="check" size={16} />
            Busk Map is open source (MIT). The brand files are in the repository under public/brand.
          </p>
        </Section>

        <section id="handoff" aria-labelledby="handoff-h" data-theme="dark" className="bm-grain flex scroll-mt-6 flex-col gap-4 border-[3px] border-rule bg-background p-6 text-foreground shadow-[8px_8px_0_var(--primary)] md:p-10">
          <span className="font-mono text-xs leading-4 font-bold tracking-[0.08em] text-signal-text uppercase">08</span>
          <h2 id="handoff-h" className={H2}>Handoff</h2>
          <p className="m-0 max-w-3xl text-lg leading-[27px]">Everything a team needs to apply Honeycomb to the app, in the design team&apos;s handoff folder (<code className="font-mono text-[0.9em]">design-handoff/</code>), which is not part of this repository. It contains:</p>
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
            <li><code className="font-mono text-[0.9em]">globals.css</code>: every token, day and night, mapped to shadcn.</li>
            <li><code className="font-mono text-[0.9em]">fonts.md</code>: the three typefaces and how to load them.</li>
            <li><code className="font-mono text-[0.9em]">logos/ favicon/ social/ kit/</code>: every file on this page.</li>
            <li><code className="font-mono text-[0.9em]">restyle-notes.md</code>: the order of work, the rules, and the copy.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
