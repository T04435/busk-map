import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Music, X } from "lucide-react";
import { BrandChoiceDemo, BrandSlotDemo } from "@/components/brand/brand-demos";
import { COMPONENT_GROUPS } from "@/components/brand/brand-tables";
import { PhoneFold } from "@/components/brand/phone-fold";
import { AgentStatusLine } from "@/components/honeycomb/agent-status-line";
import { Banner } from "@/components/honeycomb/banner";
import { BothAgreeBadge } from "@/components/honeycomb/both-agree-badge";
import { Chip } from "@/components/honeycomb/chip";
import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { EvidenceLine } from "@/components/honeycomb/evidence-line";
import { ExampleActCard } from "@/components/honeycomb/example-act-card";
import { FormMessage } from "@/components/honeycomb/form-message";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { LeanBar } from "@/components/honeycomb/lean-bar";
import { Loader } from "@/components/honeycomb/loader";
import { QlooWordmark } from "@/components/honeycomb/logo";
import { MapLegend } from "@/components/map/map-legend";
import { NoteCard } from "@/components/honeycomb/note-card";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { PitchRow } from "@/components/honeycomb/pitch-row";
import { PlanAlert } from "@/components/honeycomb/plan-alert";
import { RankTile } from "@/components/honeycomb/rank-tile";
import { ResearchFunnel } from "@/components/honeycomb/research-funnel";
import { StatStrip } from "@/components/honeycomb/stat-strip";
import { WeatherStrip } from "@/components/plan/weather-strip";
import { StatusCard } from "@/components/status/status-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CARD = "flex min-w-0 flex-col gap-2.5 border-2 border-rule bg-card p-5";
const GROUP_H = "m-0 font-display text-[22px] leading-none font-extrabold uppercase";

function List({ names }: { names: readonly string[] }) {
  return <p className="m-0 font-mono text-xs leading-[18px] text-muted-foreground">{names.join(" · ")}</p>;
}

/** One of the eight component groups: a card with its live specimens, then every component's name. */
function Group({ title, names, children, wide }: { title: string; names: readonly string[]; children: ReactNode; wide?: boolean }) {
  return (
    <PhoneFold heading={title} headingClassName={GROUP_H} wideClassName={`${CARD} gap-3.5${wide ? " lg:col-span-2" : ""}`}>
      {children}
      <List names={names} />
    </PhoneFold>
  );
}

/** A small taste map: heat cells, three pitch pins, a river and no-busking zones as hatched cells (never a rectangle, F16). */
function MapSpecimen() {
  const cell = (cx: number, cy: number, r = 13) => Array.from({ length: 6 }, (_, i) => `${(cx + r * Math.sin((Math.PI / 3) * i)).toFixed(1)},${(cy - r * Math.cos((Math.PI / 3) * i)).toFixed(1)}`).join(" ");
  const heat: [number, number, number][] = [[120, 70, 5], [144, 70, 4], [132, 91, 4], [108, 91, 3], [156, 91, 3], [120, 112, 3], [144, 112, 2], [96, 70, 2]];
  const zones: [number, number][] = [[212, 52], [236, 52], [224, 73], [248, 73]];
  return (
    <svg role="img" aria-label="Taste map: honeycomb heat cells, three numbered pitches, a river and hatched no-busking cells" viewBox="0 0 300 170" className="block w-full border-2 border-rule bg-secondary">
      <defs>
        <pattern id="brand-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--card)" />
          <rect width="2" height="6" fill="var(--zone-pink)" />
        </pattern>
      </defs>
      <path d="M0 128 C70 100 120 150 190 128 S270 110 300 120" fill="none" stroke="var(--event)" strokeWidth="14" opacity="0.45" />
      {zones.map(([x, y]) => (
        <polygon key={`${x}${y}`} points={cell(x, y, 13)} fill="url(#brand-hatch)" stroke="var(--zone-pink)" strokeWidth="1.5" />
      ))}
      {heat.map(([x, y, s]) => (
        <polygon key={`${x}${y}`} points={cell(x, y, 13)} fill={`var(--taste-${s})`} stroke="var(--rule)" strokeWidth="1" />
      ))}
      {[[132, 91, 1], [108, 91, 2], [156, 91, 3]].map(([x, y, n]) => (
        <g key={n}>
          <polygon points={cell(x, y, 9)} fill="var(--primary)" stroke="var(--rule)" strokeWidth="2" />
          <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--primary-foreground)">{n}</text>
        </g>
      ))}
    </svg>
  );
}

function PickedSong({ title, by, time, mine }: { title: string; by: string; time: string; mine?: boolean }) {
  return (
    <li className="flex items-center gap-3 border-2 border-border bg-secondary/60 p-2.5">
      <HexCell size={36} tone="muted"><Music aria-hidden="true" className="size-4" /></HexCell>
      <span className="min-w-0 flex-1">
        <b className="block leading-5">{title}</b>
        <span className="text-sm text-muted-foreground">{by}</span>
      </span>
      {mine ? <Badge variant="solid">Your song</Badge> : null}
      <span className="font-mono text-xs">{time}</span>
      <span aria-hidden="true" className="grid size-8 place-items-center"><X className="size-4" /></span>
    </li>
  );
}

const WEATHER = {
  hours: [12, 13, 14].map((hour, i) => ({ hour, temperatureC: 20 + (i === 1 ? 1 : 0), precipitationProbability: 5, windKmh: 9 + i })),
  around: [{ hour: 11, temperatureC: 19, precipitationProbability: 5, windKmh: 9 }, { hour: 15, temperatureC: 21, precipitationProbability: 10, windKmh: 12 }],
};

/** The eight component groups, each with its key pieces live and every component named. */
export function ComponentGroups() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
      <Group title="Controls" names={COMPONENT_GROUPS.controls}>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button>Plan my busk <ArrowRight aria-hidden="true" /></Button>
          <Button variant="outline"><Calendar aria-hidden="true" />Week</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Delete</Button>
          <Button disabled>Disabled</Button>
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
        <div className="flex flex-wrap gap-2">
          <Chip selected icon={<Music />}>Folk</Chip>
          <Chip>Americana</Chip>
        </div>
      </Group>

      <Group title="Feedback and honesty" names={COMPONENT_GROUPS.feedback}>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="event">Event</Badge>
          <Badge variant="weather">Weather</Badge>
          <Badge variant="estimate">Example data</Badge>
          <Badge variant="legal">Permit pitch</Badge>
          <Badge variant="restricted">Restricted</Badge>
          <Badge variant="destructive">Error</Badge>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <DataStatusBadge status="live" source="Qloo" />
          <DataStatusBadge status="cached" source="Weather" />
          <DataStatusBadge status="estimated" source="Foot traffic" />
          <DataStatusBadge status="unavailable" source="Events" reason="no answer" />
        </div>
        <Alert variant="warning"><AlertTitle>The city&apos;s sensors didn&apos;t answer</AlertTitle><AlertDescription>Foot traffic is estimated and marked &quot;est.&quot;.</AlertDescription></Alert>
        <Alert variant="info"><AlertTitle>Info</AlertTitle><AlertDescription>Planning again for The Larkspur Two.</AlertDescription></Alert>
        <Banner tone="test">Test data: nothing here is a real pitch.</Banner>
        <Banner tone="less">Less data for this city: some sources are missing.</Banner>
      </Group>

      <Group title="Plan your busk" names={COMPONENT_GROUPS.plan}>
        <BrandChoiceDemo />
        <BrandSlotDemo />
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <b>Your picks</b>
            <span className="font-mono text-xs text-muted-foreground">2 songs · 4:56</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            <PickedSong title="Fast Car" by="Tracy Chapman" time="4:56" />
            <PickedSong title="Laneway Light" by="The Larkspur Two" time="3:12" mine />
          </ul>
        </div>
      </Group>

      <Group title="Map" names={COMPONENT_GROUPS.map}>
        <MapSpecimen />
        <div className="border-2 border-rule"><MapLegend zones className="border-t-0" /></div>
      </Group>

      <Group title="The busk" names={COMPONENT_GROUPS.busk} wide>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          <PitchRow rank={1} name="Southbank Promenade" when="12–3 pm" score={91} selected badges={<DiscoveryBadge discovery="hidden-gem" />} />
          <PitchRow rank={3} name="Degraves Street" score={78} badges={<><DiscoveryBadge discovery="usual" /><BothAgreeBadge /></>} />
        </ul>
        <WeatherStrip weather={WEATHER} slot={{ startHour: 12, endHour: 15 }} />
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          <LeanBar label="Age 25–34" lean={0.41} />
          <LeanBar label="Age 55+" lean={-0.3} />
        </ul>
        <EvidenceLine>Qloo insights: the strongest folk taste area in your slot.</EvidenceLine>
      </Group>

      <Group title="Research" names={COMPONENT_GROUPS.research}>
        <ResearchFunnel
          totals={{ taste: 412, crowds: 1, places: 4, events: 1, sensors: 2, rules: 37, scored: 36, songs: 3 }}
          live={false}
          picks={3}
        />
      </Group>

      <Group title="Week" names={COMPONENT_GROUPS.week}>
        <div className="flex gap-3 border-2 border-rule bg-popover p-3">
          <RankTile n={1} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">Sat 18 Oct · 6–9 pm</span>
            <b className="font-display text-[22px] leading-none font-extrabold uppercase">Southbank Promenade</b>
            <span>The footy crowd walks the river after the game.</span>
            <span><DiscoveryBadge discovery="hidden-gem" /></span>
          </div>
          <PercentCell value={88} size={44} label="Score" />
        </div>
      </Group>

      <Group title="States and app shell" names={COMPONENT_GROUPS.shell}>
        <StatusCard embedded testId="brand-status-notfound" title="No pitch here" description="This page doesn't exist." actions={<Button asChild variant="outline"><Link href="/">Busk Map home</Link></Button>} footnote="Reference: a1b2c3" />
      </Group>
    </div>
  );
}

const SPEC = "flex min-w-0 flex-col gap-2 border-2 border-rule bg-card p-4";
const SPEC_H = "m-0 font-mono text-[11px] leading-4 font-bold tracking-[0.08em] text-muted-foreground uppercase";

/** Plan states, research and the shell: the plan page's alerts, status lines, form messages and the cards beside them. */
export function PlanStates() {
  return (
    <PhoneFold heading="Plan states, research and the shell" headingClassName="m-0 font-display text-[30px] leading-none font-extrabold uppercase">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3">
        <div className={SPEC}>
          <h4 className={SPEC_H}>PlanAlert · limit</h4>
          <PlanAlert kind="limit" message="You've started 5 plans this hour. Try again in about 20 minutes, or open one of your earlier plans." testId="brand-alert-limit" />
        </div>
        <div className={SPEC}>
          <h4 className={SPEC_H}>PlanAlert · Qloo unavailable</h4>
          <Alert variant="error"><AlertTitle>Qloo is unavailable</AlertTitle><AlertDescription>Busk Map needs Qloo&apos;s taste data to plan. Please try again in a few minutes.</AlertDescription></Alert>
        </div>
        <div className={SPEC}>
          <h4 className={SPEC_H}>PlanAlert · from the data alone</h4>
          <PlanAlert kind="fallback" note="Claude is taking too long, so this is Busk Map's plan from the scores. Claude's explanations are left out." testId="brand-alert-fallback" />
        </div>
        <div className={SPEC}>
          <h4 className={SPEC_H}>PlanAlert · no legal pitch</h4>
          <Alert variant="warning"><AlertTitle>No pitch to recommend</AlertTitle><AlertDescription>No legal pitch fits this slot and permit. Try another time or permit. <b className="underline underline-offset-3">Read the council&apos;s busking rules</b></AlertDescription></Alert>
        </div>
        <div className={SPEC}>
          <h4 className={SPEC_H}>AgentStatusLine ×3</h4>
          <AgentStatusLine state="researching" />
          <AgentStatusLine state="replayed" note="Claude's plan, replayed." />
          <AgentStatusLine state="none" />
        </div>
        <div className={SPEC}>
          <h4 className={SPEC_H}>FormMessage ×3</h4>
          <FormMessage>Loading your songs from Spotify…</FormMessage>
          <FormMessage tone="error" alert={false}>Pick today or a later date.</FormMessage>
          <FormMessage tone="success">Logged A$85 at Hardware Lane.</FormMessage>
        </div>
        <div className={`${SPEC} sm:col-span-full`}>
          <h4 className={SPEC_H}>StatStrip · Qloo</h4>
          <StatStrip className="max-sm:[&>li:last-child:nth-child(odd)]:col-span-full" tone="qloo" label="Qloo in numbers" items={[{ n: 11, label: "kinds of Qloo call" }, { n: "24–33", label: "Qloo calls for a new busk" }, { n: "0", label: "on a rerun" }]} />
        </div>
        <div className={SPEC}>
          <h4 className={SPEC_H}>ExampleActCard · NoteCard next</h4>
          <ExampleActCard name="Folk duo" blurb="Fiddle and guitar, Sunday afternoon" soundsLike="Gillian Welch" href="/brand#components" />
          <NoteCard variant="next">Taste from genres as well as artists</NoteCard>
        </div>
        <div className={SPEC}>
          <h4 className={SPEC_H}>Loader · Numbers</h4>
          <div className="flex flex-wrap items-center gap-4">
            <HexCell size={56} tone="dashed"><Loader size={22} label="Working" /></HexCell>
            <PercentCell value={91} size={56} label="Score" tone="primary" />
            <PercentCell value={64} size={48} label="Taste match" />
            <PercentCell value={null} size={48} label="Score" />
          </div>
        </div>
        <div className={SPEC}>
          <h4 className={SPEC_H}>QlooWordmark</h4>
          <QlooWordmark width={160} />
          <span className="text-sm text-muted-foreground">Every Qloo logo links to qloo.com in a new tab.</span>
        </div>
      </div>
      <p className="m-0 text-sm text-muted-foreground">BrainMap, StatusCard, PageHeader and SiteFooter render full size on their own pages. Every state of every component is in the design system: Busk Map · Honeycomb.</p>
    </PhoneFold>
  );
}
