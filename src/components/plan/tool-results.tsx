import type { ReactNode } from "react";
import { Footprints, ListMusic, MapPin, Scale, Store, Ticket, Users } from "lucide-react";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { EvidenceLine } from "@/components/honeycomb/evidence-line";
import { MeterBar, PercentCell } from "@/components/honeycomb/percent-cell";
import { PitchRow } from "@/components/honeycomb/pitch-row";
import { WithCells } from "@/components/honeycomb/with-cells";
import { RankTile } from "@/components/honeycomb/rank-tile";
import { LearnItMenu } from "@/components/songs/learn-it-menu";
import type { AgentStep } from "@/lib/agent-steps";
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

function Fact({ icon, title, sub, children }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 flex-none text-muted-foreground [&>svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="m-0 font-bold">{title}</p>
        {sub ? <p className="m-0 text-sm text-muted-foreground">{sub}</p> : null}
        {children}
      </div>
    </div>
  );
}

const HEXP = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const t = (Math.PI / 180) * (60 * i - 90);
    return `${(x + r * Math.cos(t)).toFixed(1)},${(y + r * Math.sin(t)).toFixed(1)}`;
  }).join(" ");

/**
 * "Where your crowd gathers": a framed mini taste map (board B45). The strongest cells draw as bare orange cells (steps 3 and 4, like
 * the big map), the ranked pitches as numbered pins, and the first pitch carries its name. It is a sketch of the cells Qloo returned,
 * not a street map: the real map is in "Your busk".
 */
function MiniTasteMap({ cells, pins }: { cells: Rec[]; pins: MiniPin[] }) {
  const pts = [
    ...cells.map((c) => ({ lat: num(c.lat), lon: num(c.lon) })),
    ...pins.map((p) => ({ lat: p.lat, lon: p.lon })),
  ].filter((p): p is { lat: number; lon: number } => p.lat !== null && p.lon !== null);
  if (pts.length === 0) return null;
  const W = 320;
  const H = 170;
  const pad = 26;
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
  const step = (a: number) => (a >= 0.78 ? 4 : 3);
  const first = pins.find((p) => p.rank === 1);
  return (
    <svg role="img" aria-label={`A sketch of the strongest taste cells${pins.length ? ` and your top ${pins.length} pitches` : ""}`} viewBox={`0 0 ${W} ${H}`} className="bm-hatch-field block h-auto w-full border-2 border-rule bg-muted">
      {cells.map((c, i) => {
        const lat = num(c.lat);
        const lon = num(c.lon);
        if (lat === null || lon === null) return null;
        return <polygon key={i} points={HEXP(px(lon), py(lat), 15)} fill={`var(--taste-${step(num(c.affinity) ?? 0)})`} stroke="var(--rule)" strokeOpacity={0.3} />;
      })}
      {pins.map((p) => (
        <g key={p.id}>
          <polygon points={HEXP(px(p.lon), py(p.lat), p.rank === 1 ? 14 : 11)} fill="var(--bluestone)" stroke="var(--primary)" strokeWidth={3} />
          <text x={px(p.lon)} y={py(p.lat) + 5} textAnchor="middle" fill="var(--primary)" style={{ font: "800 14px var(--font-display)" }}>
            {p.rank}
          </text>
        </g>
      ))}
      {first ? (
        <g>
          <rect x={Math.min(W - 4 - first.name.length * 7.2 - 10, Math.max(4, px(first.lon) - (first.name.length * 7.2 + 10) / 2))} y={py(first.lat) + 18} width={first.name.length * 7.2 + 10} height={18} fill="var(--card)" stroke="var(--rule)" strokeWidth={2} />
          <text x={Math.min(W - 4 - first.name.length * 7.2 - 5, Math.max(9, px(first.lon) - (first.name.length * 7.2) / 2))} y={py(first.lat) + 31} fill="var(--foreground)" style={{ font: "700 10.5px var(--font-mono)", textTransform: "uppercase" }}>
            {first.name}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

const Foot = ({ children }: { children: ReactNode }) => <p className="m-0 text-sm text-muted-foreground">{children}</p>;

/** `pins`: the busk's ranked pitches, once the plan exists, so a card's mini map can show them. */
export type MiniPin = { id: string; name: string; lat: number; lon: number; rank: number };
type Ctx = { when?: string; pins?: MiniPin[] };
type ToolUi = { doing: (s: AgentStep) => string; title: (s: AgentStep) => string; render: (out: Rec, s: AgentStep, ctx: Ctx) => ReactNode };

/** Each tool as a busker sees it: what it is doing while it runs, a plain title once done, and its result drawn from the contract fields. */
export const TOOL_UI: Record<string, ToolUi> = {
  taste_map: {
    doing: () => "Finding where your kind of crowd gathers",
    title: () => "Where your crowd gathers",
    render: (o, _s, ctx) => {
      const top = arr(o.strongest).slice(0, 3);
      const signals = Array.isArray(o.signals) ? (o.signals as string[]) : [];
      return (
        <>
          <MiniTasteMap cells={arr(o.strongest)} pins={ctx.pins ?? []} />
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {top.map((c, i) => (
              <li key={i} className="flex items-center gap-3">
                <RankTile n={num(c.rank) ?? i + 1} size="sm" quiet={i > 0} />
                <span className="min-w-0 flex-1 font-bold">{str(c.near) ?? "A block without a name"}</span>
                <PercentCell value={pct(c.affinity)} size={36} label="Taste match" />
              </li>
            ))}
          </ol>
          <EvidenceLine>
            Qloo heatmap: the strongest of {num(o.cells) ?? top.length} taste cells for {signals.length ? signals.join(", ") : "your artists"}.
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
            <div className="space-y-2">
              <h4 className="m-0 font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Artists this crowd likes</h4>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {artists.map((a) => (
                  <li key={str(a.name) ?? ""} className="flex items-center gap-2">
                    <PercentCell value={pct(a.affinity)} size={34} label="Affinity" />
                    <b>{str(a.name)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Foot>No crowd data here.</Foot>
          )}
          {genres.length ? (
            <div className="space-y-2">
              <h4 className="m-0 font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Sounds of this crowd</h4>
              <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
                {genres.map((g) => (
                  <MeterBar key={str(g.genre) ?? ""} label={str(g.genre) ?? ""} value={num(g.affinity)} />
                ))}
              </ul>
            </div>
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
        <Fact icon={<Store />} title={`${open} of ${rows.length} open in your slot`}>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {rows.map((p) => (
              <li key={str(p.name) ?? ""} className="flex flex-wrap justify-between gap-x-3">
                <span>{str(p.name)}</span>
                <span className="font-mono text-muted-foreground">
                  {n0(num(p.distanceM))} m · {p.open === "open" ? "open" : "hours not confirmed"}
                </span>
              </li>
            ))}
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
      if (!events.length) return <Fact icon={<Ticket />} title="No ticketed events nearby" sub={str(o.window) ? `Between ${str(o.window)}` : undefined} />;
      return (
        <div className="flex flex-col gap-3">
          {events.map((e, i) => {
            const m = str(e.headlinerMatch) ? /(.+) ([\d.]+)$/.exec(str(e.headlinerMatch) as string) : null;
            const ends = str(e.ends);
            return (
              <Fact
                key={`${str(e.name)}-${i}`}
                icon={<Ticket />}
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
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <PercentCell value={Math.round(Number(m[2]) * 100)} size={34} label="Taste match" />
                    Qloo: {m[1]}&apos;s fans match your taste
                  </span>
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
      if (!s || people === null) return <Fact icon={<Footprints />} title="No sensor count near here" sub="Foot traffic is estimated from busy places and events." />;
      const hour = num(o.hour);
      return (
        <Fact
          icon={<Footprints />}
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
        <Fact icon={<MapPin />} title={out ? "Ruled out by the council's busking rules" : unknown ? "The rules are unavailable right now" : "Not ruled out for your permit"}>
          {cautions.length ? (
            <ul className="m-0 list-disc pl-5 text-sm" aria-label="Rules to check">
              {cautions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}
          <Foot>Busk Map never confirms a pitch is legal. Check the rules before you play.</Foot>
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
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {list.map((p, i) => (
              <PitchRow
                key={str(p.pitchId) ?? i}
                rank={i + 1}
                name={str(p.name) ?? "Pitch"}
                when={ctx.when}
                score={num(p.score) ?? 0}
                badges={<DiscoveryBadge discovery={p.discovery === "hidden-gem" ? "hidden-gem" : p.discovery === "usual" ? "usual" : null} />}
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
        <div className="grid gap-4 sm:grid-cols-2">
          {names.map((name, j) => (
            <div key={name} className="space-y-2">
              <div className="flex items-center gap-2">
                <RankTile n={j + 1} size="sm" quiet />
                <b className="min-w-0 flex-1">{name}</b>
                <PercentCell value={num(scores[name])} size={36} label="Score" />
              </div>
              <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
                {genres.map((g) => (
                  <MeterBar key={str(g.genre) ?? ""} label={str(g.genre) ?? ""} value={num(j ? g.b : g.a)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    },
  },
  build_setlist: {
    doing: () => "Ordering your setlist",
    title: (s) => `Your setlist at ${forPitch(s)}`,
    render: (o) => (
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {arr(o.songs).slice(0, 4).map((x, i) => (
          <li key={`${str(x.song)}${i}`} className="flex items-start gap-2">
            <span className="min-w-0 flex-1">
              <b>{str(x.song)}</b> <span className="text-muted-foreground">· {str(x.artist)}{num(x.year) ? `, ${num(x.year)}` : ""}</span>
              {str(x.why) ? <span className="block text-sm text-muted-foreground"><WithCells text={str(x.why) as string} size={28} /></span> : null}
            </span>
            <PercentCell value={num(x.score)} size={36} label="Fit" />
          </li>
        ))}
      </ol>
    ),
  },
  learn_these: {
    doing: () => "Finding songs worth learning",
    title: () => "Songs worth learning",
    render: (o) => (
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {arr(o.songs).slice(0, 3).map((x, i) => (
          <li key={`${str(x.artist)}${i}`} className="flex items-start gap-3">
            <b className="font-mono">{i + 1}</b>
            <span className="min-w-0 flex-1">
              <b>{str(x.title) ?? "Any song"}</b> · {str(x.artist)}
              {str(x.why) ? <small className="block text-muted-foreground"><WithCells text={str(x.why) as string} size={28} /></small> : null}
            </span>
            {str(x.title) ? <LearnItMenu title={str(x.title) as string} artist={str(x.artist) ?? ""} /> : null}
          </li>
        ))}
      </ol>
    ),
  },
  finish_plan: {
    doing: () => "Putting your busk together",
    title: (s) => (s.status === "failed" ? "Sent back to check more" : "Your busk is ready"),
    render: (_o, s) => <Foot>{s.status === "failed" ? "Busk Map asked the model to look closer before answering. It keeps going." : "Three pitches, a setlist for each and the reasons, above."}</Foot>,
  },
};

export const TOOL_ICON = { taste_map: MapPin, crowd_at: Users, busy_places: Store, events_near: Ticket, footfall_at: Footprints, check_pitch: MapPin, score_pitches: MapPin, compare_crowds: Scale, build_setlist: ListMusic, learn_these: ListMusic, finish_plan: MapPin } as const;
