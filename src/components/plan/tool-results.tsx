import type { ReactNode } from "react";
import { cn } from "cn";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { EvidenceLine } from "@/components/honeycomb/evidence-line";
import { FoundByBadge } from "@/components/honeycomb/found-by-badge";
import { Icon, type IconName } from "@/components/honeycomb/icon";
import { MeterBar, PercentCell } from "@/components/honeycomb/percent-cell";
import { PitchRow } from "@/components/honeycomb/pitch-row";
import { RankTile } from "@/components/honeycomb/rank-tile";
import { WithCells } from "@/components/honeycomb/with-cells";
import { LearnItMenu } from "@/components/songs/learn-it-menu";
import type { AgentStep } from "@/lib/agent-steps";
import type { ExplanationsModel } from "@/lib/sources";
import { EstimateLabel } from "./estimate-label";

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? v.map(rec) : []);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const n0 = (v: number | null) => (v === null ? "no data" : Math.round(v).toLocaleString("en-AU"));
const pct = (v: unknown) => (num(v) === null ? null : Math.round((num(v) as number) * 100));

/** Where a step looked: the place named in its output, else in its inputs. */
export function placeOf(step: AgentStep): string {
  const out = rec(step.output);
  const at = rec(out.at);
  const label = str(at.label);
  if (label) return label.replace(/^near /, "");
  const input = rec(step.input);
  const where = rec(input.at ?? input.near ?? input.spot ?? input.point);
  return str(where.spot) ?? str(where.label) ?? str(where.pitchName) ?? (str(where.pitchId) ? String(where.pitchId).replace(/^[a-z]+:(osm:)?/, "").replace(/-/g, " ") : null) ?? "this spot";
}
const forPitch = (step: AgentStep) => /for (.+?)[;:]/.exec(step.summary ?? "")?.[1] ?? "this pitch";

/** The DS icon tone: the colour a fact's icon takes (bm-ic-*). */
export type FactTone = "places" | "event" | "footfall" | "weather" | "legal";
const TONE: Record<FactTone, string> = { places: "text-chart-3", event: "text-event", footfall: "text-footfall", weather: "text-weather", legal: "text-pitch-legal" };

/**
 * One fact: an icon in a 24px column, a bold title, an optional muted line and any extras (the DS Fact). Inside a research card it is
 * `flush` (no rule, no padding); in the pitch card's facts list it keeps its rule underneath.
 */
export function Fact({ icon, tone, title, sub, flush = false, children }: { icon: IconName; tone?: FactTone; title: ReactNode; sub?: ReactNode; flush?: boolean; children?: ReactNode }) {
  return (
    <div className={cn("grid grid-cols-[24px_1fr] gap-3 text-[15px] leading-[22px]", flush ? "" : "border-b border-border py-3")}>
      <Icon name={icon} size={20} className={cn("mt-px", tone && TONE[tone])} />
      <div className="min-w-0">
        <div className="font-bold">{title}</div>
        {sub ? <div className="text-sm leading-5 text-muted-foreground">{sub}</div> : null}
        {children}
      </div>
    </div>
  );
}

/** Qloo's detail under a place or an event: 13px, muted (bm-qloo-detail). */
export const QlooDetail = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("block text-[13px] leading-[18px] font-normal text-muted-foreground", className)}>{children}</span>
);

/** The rules a pitch asks the busker to check, each with the warning icon (bm-cautions). */
export function Cautions({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="m-0 mt-2 grid list-none gap-1.5 p-0 text-sm leading-5 font-normal" aria-label="Rules to check">
      {items.map((c) => (
        <li key={c} className="grid grid-cols-[18px_1fr] gap-2">
          <Icon name="warning" size={18} className="mt-px text-pitch-restricted" />
          <span>{c}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Busk Map never confirms a pitch is legal." (bm-never) */
export const NeverConfirms = ({ className }: { className?: string }) => (
  <p className={cn("m-0 mt-2 text-[13px] leading-[18px] font-normal text-muted-foreground italic", className)}>Busk Map never confirms a pitch is legal. Check the rules before you play.</p>
);

const HEXP = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const t = (Math.PI / 180) * (60 * i - 90);
    return `${(x + r * Math.cos(t)).toFixed(1)},${(y + r * Math.sin(t)).toFixed(1)}`;
  }).join(" ");

/**
 * "Where your crowd gathers": a framed mini taste map (board B45). Only the orange cells draw (F05: steps 3 to 5), the ranked
 * pitches (or, before the plan exists, the strongest cells) as numbered pins, and the first one carries its name. It is a sketch of the
 * cells Qloo returned, not a street map: the real map is in "Your busk".
 */
function MiniTasteMap({ cells, pins }: { cells: Rec[]; pins: MiniPin[] }) {
  const pts = [
    ...cells.map((c) => ({ lat: num(c.lat), lon: num(c.lon) })),
    ...pins.map((p) => ({ lat: p.lat, lon: p.lon })),
  ].filter((p): p is { lat: number; lon: number } => p.lat !== null && p.lon !== null);
  if (pts.length === 0) return null;
  const W = 560;
  const H = 300;
  const pad = 40;
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const minLon = Math.min(...lons);
  const k = Math.cos((minLat * Math.PI) / 180);
  const spanX = Math.max(0.004 * k, (Math.max(...lons) - minLon) * k);
  const spanY = Math.max(0.004, Math.max(...lats) - minLat);
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const px = (lon: number) => W / 2 + ((lon - minLon) * k - spanX / 2) * scale;
  const py = (lat: number) => H / 2 - (lat - minLat - spanY / 2) * scale;
  const step = (a: number) => (a >= 0.88 ? 5 : a >= 0.68 ? 4 : 3);
  const first = pins.find((p) => p.rank === 1);
  return (
    <svg
      role="img"
      aria-label={`Taste map: where your artists' fans concentrate${pins.length ? `, with your top ${Math.min(3, pins.length)} pitches` : ""}`}
      viewBox={`0 0 ${W} ${H}`}
      className="bm-hatch-field block h-auto max-h-[300px] w-full border border-border bg-muted"
    >
      {cells.map((c, i) => {
        const lat = num(c.lat);
        const lon = num(c.lon);
        if (lat === null || lon === null) return null;
        return <polygon key={i} points={HEXP(px(lon), py(lat), 22)} fill={`var(--taste-${step(num(c.affinity) ?? 0)})`} stroke="var(--rule)" strokeOpacity={0.3} />;
      })}
      {pins.map((p) =>
        p.rank <= 3 ? (
          <g key={p.id}>
            <polygon points={HEXP(px(p.lon), py(p.lat), p.rank === 1 ? 18 : 14)} fill="var(--bluestone)" stroke="var(--primary)" strokeWidth={3} />
            <text x={px(p.lon)} y={py(p.lat) + 6} textAnchor="middle" fill="var(--primary)" style={{ font: "800 16px var(--font-display)" }}>
              {p.rank}
            </text>
          </g>
        ) : (
          <polygon key={p.id} points={HEXP(px(p.lon), py(p.lat), 6)} fill="var(--muted-foreground)" stroke="var(--card)" strokeWidth={1.5} />
        ),
      )}
      {first ? (
        <g>
          <rect x={Math.min(W - 4 - first.name.length * 7.2 - 10, Math.max(4, px(first.lon) - (first.name.length * 7.2 + 10) / 2))} y={py(first.lat) + 22} width={first.name.length * 7.2 + 10} height={18} fill="var(--card)" stroke="var(--rule)" strokeWidth={2} />
          <text x={Math.min(W - 4 - first.name.length * 7.2 - 5, Math.max(9, px(first.lon) - (first.name.length * 7.2) / 2))} y={py(first.lat) + 35} fill="var(--foreground)" style={{ font: "700 10.5px var(--font-mono)", textTransform: "uppercase" }}>
            {first.name}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

const Foot = ({ children }: { children: ReactNode }) => <p className="m-0 text-[13px] leading-[18px] text-muted-foreground">{children}</p>;

/** A block inside a card: a condensed-caps heading over its content (bm-crowd-sec with no padding or rule). */
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="grid gap-2">
    <h4 className="m-0 font-display text-[17px] leading-5 font-extrabold uppercase">{title}</h4>
    {children}
  </div>
);

/** `pins`: the busk's ranked pitches, once the plan exists, so a card's mini map can show them. */
export type MiniPin = { id: string; name: string; lat: number; lon: number; rank: number };
type Ctx = { when?: string; pins?: MiniPin[]; model?: ExplanationsModel | null };
type ToolUi = { doing: (s: AgentStep) => string; title: (s: AgentStep) => string; render: (out: Rec, s: AgentStep, ctx: Ctx) => ReactNode };

/** "Gillian Welch 0.31; The Teskey Brothers 0.22" -> "Gillian Welch (31), The Teskey Brothers (22)" (the DS wording of "because"). */
const becauseText = (s: string) => s.replace(/ ([\d.]+)(;|$)/g, (_m, v: string, e: string) => ` (${Math.round(Number(v) * 100)})${e ? "," : ""}`);

/** Each tool as a busker sees it: what it is doing while it runs, a plain title once done, and its result drawn from the contract fields. */
export const TOOL_UI: Record<string, ToolUi> = {
  taste_map: {
    doing: () => "Finding where your kind of crowd gathers",
    title: () => "Where your crowd gathers",
    render: (o, _s, ctx) => {
      const strongest = arr(o.strongest).filter((c) => num(c.lat) !== null);
      const signals = Array.isArray(o.signals) ? (o.signals as string[]) : [];
      // Before the plan exists the strongest cells stand in as pins: the top 3 numbered, the rest small dots.
      const pins: MiniPin[] = ctx.pins?.length
        ? ctx.pins
        : strongest.map((c, i) => ({ id: `cell-${i}`, name: str(c.near) ?? "A block without a name", lat: num(c.lat) as number, lon: num(c.lon) as number, rank: i + 1 }));
      return (
        <>
          <MiniTasteMap cells={strongest} pins={pins} />
          <EvidenceLine>
            Qloo heatmap: the strongest of {num(o.cells) ?? strongest.length} taste cells for {signals.length ? signals.join(", ") : "your artists"}.
          </EvidenceLine>
        </>
      );
    },
  },
  crowd_at: {
    doing: (s) => `Getting to know the crowd at ${placeOf(s)}`,
    title: (s) => `The crowd at ${placeOf(s)}`,
    render: (o) => {
      const artists = arr(o.artists).slice(0, 3);
      const genres = arr(o.genres).slice(0, 3);
      return (
        <>
          {artists.length ? (
            <Section title="Artists this crowd likes">
              <ul className="m-0 grid list-none gap-2 p-0">
                {artists.map((a) => (
                  <li key={str(a.name) ?? ""}>
                    <div className="flex flex-wrap items-center gap-2">
                      <PercentCell value={pct(a.affinity)} size={34} label="Affinity" />
                      <b>{str(a.name)}</b>
                    </div>
                    {str(a.because) ? <p className="m-0 mt-0.5 text-sm leading-5 text-muted-foreground">Because your fans like {becauseText(str(a.because) as string)}</p> : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : (
            <Foot>No crowd data here.</Foot>
          )}
          {genres.length ? (
            <Section title="Sounds of this crowd">
              <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
                {genres.map((g) => (
                  <MeterBar key={str(g.genre) ?? ""} label={str(g.genre) ?? ""} value={num(g.affinity)} />
                ))}
              </ul>
            </Section>
          ) : null}
          <EvidenceLine>Qloo insights within {num(o.radiusM) ?? 400} m, given your artists.</EvidenceLine>
        </>
      );
    },
  },
  busy_places: {
    doing: (s) => `Looking for busy places near ${placeOf(s)}`,
    title: (s) => `Busy places near ${placeOf(s)}`,
    render: (o) => {
      const rows = arr(o.places).slice(0, 4);
      const open = rows.filter((p) => p.open === "open").length;
      return (
        <Fact flush icon="store" tone="places" title={`${open} of ${rows.length} open in your slot`}>
          <ul className="m-0 mt-1 grid list-none gap-0.5 p-0 text-sm leading-5 font-normal">
            {rows.map((p) => {
              const detail = [p.liveMusic ? "live music" : null, str(p.goodFor)].filter(Boolean).join(", ");
              return (
                <li key={str(p.name) ?? ""} className="flex justify-between gap-3">
                  <span>
                    {str(p.name)}
                    {detail ? <QlooDetail>Qloo: {detail}</QlooDetail> : null}
                  </span>
                  <span className="shrink-0 text-right font-mono text-muted-foreground tabular-nums">
                    {n0(num(p.distanceM))} m · {p.open === "open" ? "open" : p.open === "closed" ? "closed" : "hours unknown"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Fact>
      );
    },
  },
  events_near: {
    doing: (s) => `Checking events near ${placeOf(s)}`,
    title: (s) => `Events near ${placeOf(s)}`,
    render: (o) => {
      const events = arr(o.events).slice(0, 3);
      if (!events.length) return <Fact flush icon="ticket" tone="event" title="No ticketed events nearby" sub={str(o.window) ? `Between ${str(o.window)}` : undefined} />;
      return (
        <div className="grid gap-3">
          {events.map((e, i) => {
            const m = str(e.headlinerMatch) ? /(.+) ([\d.]+)$/.exec(str(e.headlinerMatch) as string) : null;
            const ends = str(e.ends);
            return (
              <Fact
                flush
                key={`${str(e.name)}-${i}`}
                icon="ticket"
                tone="event"
                title={`${str(e.name) ?? "Event"}${str(e.venue) ? ` at ${str(e.venue)}` : ""}`}
                sub={
                  <>
                    {ends ? (
                      <>
                        Crowd comes out about {ends}
                        {e.endEstimated ? <> <EstimateLabel /></> : null}
                      </>
                    ) : null}
                    {ends && num(e.distanceM) !== null ? " · " : null}
                    {num(e.distanceM) !== null ? `${n0(num(e.distanceM))} m away` : null}
                  </>
                }
              >
                {m ? (
                  <QlooDetail className="inline-flex items-center gap-2">
                    <PercentCell value={Math.round(Number(m[2]) * 100)} size={34} label="Taste match" />
                    Qloo: {m[1]}&apos;s fans match your taste
                  </QlooDetail>
                ) : null}
              </Fact>
            );
          })}
        </div>
      );
    },
  },
  footfall_at: {
    doing: (s) => `Counting foot traffic at ${placeOf(s)}`,
    title: (s) => `Foot traffic at ${placeOf(s)}`,
    render: (o) => {
      const s = arr(o.sensors)[0];
      const people = s ? num(s.peopleThisHour) : null;
      if (!s || people === null) return <Fact flush icon="footfall" tone="footfall" title="No sensor count near here" sub="Foot traffic is estimated from busy places and events." />;
      const hour = num(o.hour);
      return (
        <Fact
          flush
          icon="footfall"
          tone="footfall"
          title={
            <EstimateLabel basis={`Average of the last ${num(o.weeksOfHistory) ?? "few"} ${str(o.weekday) ?? "same day"}s at this hour`}>≈{n0(people)} people an hour</EstimateLabel>
          }
          sub={`Nearest sensor: ${str(s.sensor)}, ${n0(num(s.distanceM))} m${hour !== null ? ` · ${hour % 12 || 12} ${hour < 12 ? "am" : "pm"}` : ""}`}
        />
      );
    },
  },
  check_pitch: {
    doing: (s) => `Checking the busking rules at ${placeOf(s)}`,
    title: (s) => `The rules at ${str(rec(s.output).name) ?? placeOf(s)}`,
    render: (o) => {
      const out = o.legal === "ruled out";
      const unknown = !out && o.legal !== "not ruled out";
      const cautions = Array.isArray(o.cautions) ? (o.cautions as string[]) : [];
      return (
        <Fact flush icon={out ? "restricted" : "legal"} tone="legal" title={out ? "Ruled out by the council's busking rules" : unknown ? "The rules are unavailable right now" : "Not ruled out for your permit"}>
          <Cautions items={cautions} />
          <NeverConfirms />
        </Fact>
      );
    },
  },
  score_pitches: {
    doing: () => "Scoring the pitches",
    title: (s) => {
      const add = rec(s.input).add;
      return Array.isArray(add) && add.length > 0 ? "New pitches scored" : "Your best pitches so far";
    },
    render: (o, _s, ctx) => {
      const list = arr(o.pitches).slice(0, 3);
      const pool = num(o.poolSize);
      return (
        <>
          <ol className="m-0 grid list-none gap-2 p-0">
            {list.map((p, i) => (
              <PitchRow
                key={str(p.pitchId) ?? i}
                rank={i + 1}
                name={str(p.name) ?? "Pitch"}
                when={ctx.when}
                score={num(p.score) ?? 0}
                selected={i === 0}
                badges={
                  <>
                    <DiscoveryBadge discovery={p.discovery === "hidden-gem" ? "hidden-gem" : p.discovery === "usual" ? "usual" : null} />
                    {p.addedByYou ? <FoundByBadge origin="agent" written model={ctx.model ?? null} /> : null}
                  </>
                }
              />
            ))}
          </ol>
          {pool ? <EvidenceLine>Busk Map scored {pool} pitches allowed for your permit on taste, foot traffic, places, events and weather.</EvidenceLine> : null}
        </>
      );
    },
  },
  compare_crowds: {
    doing: () => "Comparing two crowds",
    title: (s) => {
      const k = Object.keys(rec(rec(s.output).scores));
      return k.length === 2 ? `${k[0]} or ${k[1]}?` : "Comparing two crowds";
    },
    render: (o) => {
      const scores = rec(o.scores);
      const names = Object.keys(scores);
      const genres = arr(o.genres).slice(0, 3);
      return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {names.map((name, j) => (
            <div key={name} className="grid content-start gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <RankTile n={j + 1} size="sm" quiet />
                <b className="font-display text-[17px] leading-5 font-extrabold uppercase">{name}</b>
                <PercentCell value={num(scores[name])} size={36} label="Score" />
              </div>
              <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
                {genres.map((g) => {
                  const v = num(j ? g.b : g.a);
                  return <MeterBar key={str(g.genre) ?? ""} label={str(g.genre) ?? ""} value={v ?? 0} noData={v === null} />;
                })}
              </ul>
            </div>
          ))}
        </div>
      );
    },
  },
  build_setlist: {
    doing: () => "Ordering your suggested set",
    title: (s) => `Your suggested set at ${forPitch(s)}`,
    render: (o) => (
      <ol className="m-0 list-none p-0 [counter-reset:s]">
        {arr(o.songs).slice(0, 4).map((x, i) => (
          <li
            key={`${str(x.song)}${i}`}
            className="grid grid-cols-[32px_1fr_auto] items-center gap-x-3 gap-y-0.5 border-t border-border py-3 [counter-increment:s] first:border-t-0 before:font-mono before:text-sm before:font-bold before:text-muted-foreground before:content-[counter(s,decimal-leading-zero)]"
          >
            <span>
              <span className="font-bold">{str(x.song)}</span> <span className="font-normal text-muted-foreground">· {str(x.artist)}{num(x.year) ? `, ${num(x.year)}` : ""}</span>
            </span>
            <PercentCell value={num(x.score)} size={36} label="Fit" />
            {str(x.why) ? (
              <span className="col-start-2 -col-end-1 text-sm leading-5 text-muted-foreground">
                <WithCells text={str(x.why) as string} size={28} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    ),
  },
  learn_these: {
    doing: () => "Finding songs worth learning",
    title: () => "Songs worth learning",
    render: (o) => (
      <div className="border-2 border-t-4 border-rule border-t-primary p-4">
        <ol className="m-0 grid list-none gap-2 p-0">
          {arr(o.songs).slice(0, 3).map((x, i) => (
            <li key={`${str(x.artist)}${i}`} className="grid grid-cols-[20px_1fr_auto] items-start gap-2 text-[15px] leading-[22px]">
              <b className="font-mono">{i + 1}</b>
              <span>
                <b>{str(x.title) ?? "Any song"}</b> · {str(x.artist)}
                {str(x.why) ? (
                  <small className="block text-sm leading-5 opacity-85">
                    <WithCells text={str(x.why) as string} size={28} />
                  </small>
                ) : null}
              </span>
              {str(x.title) ? <LearnItMenu title={str(x.title) as string} artist={str(x.artist) ?? ""} /> : <span />}
            </li>
          ))}
        </ol>
      </div>
    ),
  },
  best_hours: {
    doing: () => "Finding the best hours at each pitch",
    title: () => "The best hours at each pitch",
    render: (o) => {
      const pitches = arr(o.pitches);
      if (!pitches.length) return <Foot>No busking hours are left on that day.</Foot>;
      return (
        <>
          <ul className="m-0 grid list-none gap-2 p-0" data-testid="best-hours">
            {pitches.map((p) => {
              const top = arr(p.windows)[0];
              const event = top ? arr(top.events)[0] : undefined;
              const people = top ? num(top.peoplePerHour) : null;
              const rain = top ? num(top.rainPercent) : null;
              const parts = [
                people !== null ? `about ${n0(people)} people an hour` : null,
                event ? `the ${str(event.name)} crowd ${event.moment === "leaving" ? "lets out" : "arrives"} at ${str(event.at)}` : null,
                rain !== null ? (rain >= 50 ? `rain likely (${rain}%)` : rain >= 25 ? `some rain risk (${rain}%)` : "dry") : null,
              ].filter(Boolean);
              return (
                <li key={str(p.pitchId) ?? str(p.name)}>
                  <Fact flush icon="clock" tone="footfall" title={`${str(p.name)}: best ${str(p.best)}`} sub={parts.join(", ") || undefined} />
                </li>
              );
            })}
          </ul>
          <EvidenceLine>Engine data: each 3-hour window from 10 am to 10 pm, scored with typical foot traffic, events and rain. Estimates.</EvidenceLine>
        </>
      );
    },
  },
  finish_plan: {
    doing: () => "Putting your busk together",
    title: (s) => (s.status === "failed" ? "Sent back to check more" : "Your busk is ready"),
    render: (_o, s, ctx) => (
      <Foot>
        {s.status === "failed"
          ? `Busk Map asked ${ctx.model === "mock" ? "the test model" : "Claude"} to look closer before answering. It keeps going.`
          : "Three pitches, a suggested set for each and the reasons, above."}
      </Foot>
    ),
  },
};

/** The DS icon for each tool's cell; an unknown tool gets the dots glyph. */
export const TOOL_ICON: Record<string, IconName> = {
  taste_map: "map",
  crowd_at: "users",
  busy_places: "store",
  events_near: "ticket",
  footfall_at: "footfall",
  check_pitch: "legal",
  score_pitches: "pin",
  compare_crowds: "users",
  build_setlist: "list",
  learn_these: "learn",
  best_hours: "clock",
  finish_plan: "check",
};
