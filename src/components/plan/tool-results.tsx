import type { ReactNode } from "react";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { summaryLine } from "@/lib/repertoire-research";
import { artist as mentionArtist, listOf, song as mentionSong, source as mentionSource, SPOTIFY_ARTIST_URL, type MentionSource, type RichText as RichTextData } from "@/lib/mention";
import { RichText } from "@/components/honeycomb/mention";
import { reasonSlots } from "@/components/setlist/reason-slots";
import { cn } from "cn";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { FoundByBadge } from "@/components/honeycomb/found-by-badge";
import { Icon, type IconName } from "@/components/honeycomb/icon";
import { ArtistChip } from "@/components/honeycomb/artist-chip";
import { InfoTag } from "@/components/honeycomb/info-tag";
import { MeterBar } from "@/components/honeycomb/score-cell";
import { PitchRow } from "@/components/honeycomb/pitch-row";
import { RankTile } from "@/components/honeycomb/rank-tile";
import { Reason } from "@/components/honeycomb/reason";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import { SongActions } from "@/components/honeycomb/song-actions";
import { SongRow } from "@/components/honeycomb/song-row";
import { SongTag } from "@/components/honeycomb/song-tag";
import type { AgentStep } from "@/lib/agent-steps";
import { activityWord, type ActivityBasis } from "@/lib/activity";
import type { ExplanationsModel } from "@/lib/sources";
import type { LevelSignal, LevelWord } from "@/lib/signal-level";
import { LevelBadge } from "@/components/honeycomb/level-badge";
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
  return str(where.spot) ?? str(where.place) ?? str(where.label) ?? str(where.pitchName) ?? (str(where.pitchId) ? String(where.pitchId).replace(/^[a-z]+:(osm:)?/, "").replace(/-/g, " ") : null) ?? "this spot";
}
/** A check_pitch step in a city whose busking rules aren't checked (tools.ts UNCHECKED_TOOL, or its output). */
const rulesUnchecked = (step: AgentStep) => rec(step.output).legal === "not checked" || /rules not checked/.test(step.label ?? "");
const forPitch = (step: AgentStep) => /for (.+?)[;:]/.exec(step.summary ?? "")?.[1] ?? "this pitch";

/** The DS icon tone: the colour a fact's icon takes (bm-ic-*). */
export type FactTone = "places" | "event" | "footfall" | "weather" | "legal";
const TONE: Record<FactTone, string> = { places: "text-chart-3", event: "text-event", footfall: "text-footfall", weather: "text-weather", legal: "text-pitch-legal" };

/**
 * One fact (shadcn Item): an icon in a 24px column, a bold title, an optional muted line and any extras (the DS Fact). Inside a research card it is
 * `flush` (no rule, no padding); in the pitch card's facts list it keeps its rule underneath.
 */
export function Fact({ icon, tone, title, sub, level, flush = false, children }: { icon: IconName; tone?: FactTone; title: ReactNode; sub?: ReactNode; level?: LevelWord | null; flush?: boolean; children?: ReactNode }) {
  return (
    <Item className={cn("grid grid-cols-[24px_1fr] items-stretch gap-3 text-[15px] leading-[22px]", flush ? "" : "border-b border-border py-3")}>
      <ItemMedia variant="icon" className="items-start justify-start">
        <Icon name={icon} size={20} className={cn("mt-px", tone && TONE[tone])} />
      </ItemMedia>
      <ItemContent className="block">
        <ItemTitle>
          {title}
          {level ? <LevelBadge word={level} className="ml-2 align-[1px]" /> : null}
        </ItemTitle>
        {sub ? (
          <ItemDescription asChild>
            <div>{sub}</div>
          </ItemDescription>
        ) : null}
        {children}
      </ItemContent>
    </Item>
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
        <Item key={c} asChild size="xs" className="grid grid-cols-[18px_1fr] items-stretch">
          <li>
            <ItemMedia variant="icon" className="items-start justify-start">
              <Icon name="warning" size={18} className="mt-px text-pitch-restricted" />
            </ItemMedia>
            <span>{c}</span>
          </li>
        </Item>
      ))}
    </ul>
  );
}

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
type ToolUi = {
  doing: (s: AgentStep) => string;
  title: (s: AgentStep) => string;
  render: (out: Rec, s: AgentStep, ctx: Ctx) => ReactNode;
  /** A tool whose whole result is one line: the feed sets it right under the title, beside the step cell. */
  line?: (out: Rec) => RichTextData | string;
};

/** "Gillian Welch 0.31; Paul Kelly 0.2" → the because chips, each with its explained weight (0–100). */
const becauseArtists = (s: string) =>
  s
    .split(";")
    .map((part) => {
      const m = / ([\d.]+)$/.exec(part.trim());
      const weight = m ? Number(m[1]) : NaN;
      return { name: part.trim().replace(/ [\d.]+$/, "").trim(), score: Number.isFinite(weight) ? Math.round((weight <= 1 ? weight * 100 : weight)) : undefined };
    })
    .filter((a) => a.name);

/** A research step's line as RichText (U08): artists, songs and sources named inline through Mention, never as plain names. */
const researchUi = (line: (o: Rec) => RichTextData | string): ToolUi => ({
  doing: (s) => s.label,
  title: (s) => s.label,
  line,
  render: (o) => (
    <Foot>
      <RichText text={line(o)} />
    </Foot>
  ),
});
const artistOf = (a: Rec) =>
  mentionArtist(str(a.name) ?? "", { image: str(a.image), href: str(a.href) ?? (str(a.spotifyId) ? SPOTIFY_ARTIST_URL(str(a.spotifyId) as string) : null) });
const artistsLine = (lead: string, none: string) => (o: Rec) => {
  const artists = arr(o.artists).filter((a) => str(a.name));
  return artists.length ? [`${lead} `, ...listOf(artists.slice(0, 6).map(artistOf))] : none;
};
const RESEARCH_UI: Record<string, ToolUi> = {
  research_profile: researchUi((o) => (str(o.name) ? ["Read ", artistOf(o), " on ", mentionSource("spotify")] : (str(o.summary) ?? ""))),
  research_songs: researchUi((o) => {
    const songs = arr(o.songs).filter((x) => str(x.title));
    if (!songs.length) return str(o.summary) ?? "";
    // The source's logo is an image: its name follows in words, so the line never reads "from ,".
    const from = str(o.source) === "spotify" || str(o.source) === "lastfm" ? [" from ", mentionSource(str(o.source) as "spotify" | "lastfm"), str(o.source) === "spotify" ? " Spotify" : " Last.fm"] : [];
    // Spotify gave no catalogue (rate-limited or down): say so plainly, then what was added from Last.fm.
    if (o.spotifyDown === "limited" || o.spotifyDown === "down") {
      return [o.spotifyDown === "limited" ? "Spotify isn't answering right now, so " : "Spotify didn't answer, so ", `${num(o.added) ?? songs.length} of your songs come from `, mentionSource("lastfm"), " Last.fm, including ", ...listOf(songs.slice(0, 3).map((x) => mentionSong(str(x.title) as string, { artist: str(x.artist), image: str(x.image), href: str(x.href) })))];
    }
    return [
      `Added ${num(o.added) ?? songs.length} of your songs`,
      ...from,
      ", including ",
      ...listOf(songs.slice(0, 3).map((x) => mentionSong(str(x.title) as string, { artist: str(x.artist), image: str(x.image), href: str(x.href) }))),
    ];
  }),
  research_qloo: researchUi((o) => {
    if (!o.matched || !str(o.name)) return str(o.summary) ?? "";
    const audience = Array.isArray(o.audience) ? (o.audience as string[]) : [];
    return ["Found ", mentionArtist(str(o.name) as string, { image: str(o.image) }), " on ", mentionSource("qloo"), ...(audience.length ? [`: ${audience.slice(0, 4).join(", ")}`] : [])];
  }),
  research_sounds_like: researchUi(artistsLine("You sound like", "Qloo found no artists like you")),
  research_fans_map: researchUi((o) => {
    const areas = Array.isArray(o.areas) ? (o.areas as unknown[]).filter((a): a is string => typeof a === "string" && a.length > 0) : [];
    if (!areas.length) return str(o.summary) ?? "";
    return [`Your crowd is strongest in ${areas.length === 1 ? areas[0] : `${areas.slice(0, -1).join(", ")} and ${areas[areas.length - 1]}`}`];
  }),
  research_fans_love: researchUi(artistsLine("Your fans also love", "Qloo found no other artists your fans love")),
  research_learn: researchUi((o) => {
    const songs = arr(o.songs).filter((x) => str(x.title));
    return songs.length
      ? [`Found ${songs.length} ${songs.length === 1 ? "song" : "songs"} your fans would stop for, like `, ...listOf(songs.slice(0, 3).map((x) => mentionSong(str(x.title) as string, { artist: str(x.artist), image: str(x.artistImage) })))]
      : (str(o.summary) ?? "");
  }),
  // Step 9 in the Hive's voice from its data, so a saved run from before U11 ("Claude ranked…") reads the same as a new one.
  research_summary: researchUi((o) => summaryLine(str(o.by) ?? "template", num(o.picks) ?? 0)),
};

/** Each tool as a busker sees it: what it is doing while it runs, a plain title once done, and its result drawn from the contract fields. */
export const TOOL_UI: Record<string, ToolUi> = {
  ...RESEARCH_UI,
  // A metro planned across its areas: the areas compared, by name, best first.
  compare_areas: {
    doing: () => "Comparing areas across the city",
    title: () => "Areas across the city",
    line: (o) => str(o.summary) ?? "",
    render: (o) => <Foot>{str(o.summary) ?? ""}</Foot>,
  },
  taste_map: {
    doing: () => "Mapping where your crowd gathers",
    title: () => "Where your crowd gathers",
    render: (o, _s, ctx) => {
      const strongest = arr(o.strongest).filter((c) => num(c.lat) !== null);
      // Before the plan exists the strongest cells stand in as pins: the top 3 numbered, the rest small dots.
      const pins: MiniPin[] = ctx.pins?.length
        ? ctx.pins
        : strongest.map((c, i) => ({ id: `cell-${i}`, name: str(c.name) ?? str(c.near) ?? "Taste spot", lat: num(c.lat) as number, lon: num(c.lon) as number, rank: i + 1 }));
      return <MiniTasteMap cells={strongest} pins={pins} />;
    },
  },
  crowd_at: {
    doing: (s) => `Learning who gathers at ${placeOf(s)}`,
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
                    <ArtistChip name={str(a.name) ?? ""} score={<ScoreCell value={pct(a.affinity)} size="sm" label="Affinity" />}>
                      {str(a.because) ? <Reason text={["Because your fans like ", ...becauseArtists(str(a.because) as string).flatMap((x, i) => [...(i ? [", "] : []), { kind: "artist" as const, ...x }])]} /> : null}
                    </ArtistChip>
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
        </>
      );
    },
  },
  busy_places: {
    doing: (s) => `Listing busy places near ${placeOf(s)}`,
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
                    {detail ? <QlooDetail>{detail}</QlooDetail> : null}
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
    doing: (s) => `Looking for events near ${placeOf(s)}`,
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
                  <ArtistChip
                    name={m[1]}
                    score={<ScoreCell value={Math.round(Number(m[2]) * 100)} size="sm" label="Taste match" />}
                    info={<InfoTag tone="qloo">Qloo: fans match your taste</InfoTag>}
                  />
                ) : null}
              </Fact>
            );
          })}
        </div>
      );
    },
  },
  activity_at: {
    doing: (s) => `Estimating activity near ${placeOf(s)}`,
    title: (s) => `Estimated activity at ${placeOf(s)}`,
    render: (o) => {
      const level = num(o.relativeLevel) ?? num(o.level);
      const basis = str(o.basis) as ActivityBasis | null;
      if (level === null || basis === null || basis === "none") {
        return <Fact flush icon="footfall" tone="footfall" title="No activity estimate here" />;
      }
      const open = Array.isArray(o.placesOpen) ? o.placesOpen.filter((x): x is string => typeof x === "string") : [];
      return (
        <Fact
          flush
          icon="footfall"
          tone="footfall"
          title={<EstimateLabel>{activityWord(level)}</EstimateLabel>}
          sub={`${str(o.window) ?? ""}${open.length ? ` · popular places open: ${open.join(", ")}` : ""}`.replace(/^ · /, "")}
        />
      );
    },
  },
  check_pitch: {
    // V2 2.4: where the rules aren't checked the step only looks at a spot (its server label says so), so it names no rules.
    doing: (s) => (rulesUnchecked(s) ? `Looking at ${placeOf(s)}` : `Checking the busking rules at ${placeOf(s)}`),
    title: (s) => (rulesUnchecked(s) ? `A look at ${str(rec(s.output).name) ?? placeOf(s)}` : `The rules at ${str(rec(s.output).name) ?? placeOf(s)}`),
    render: (o) => {
      const out = o.legal === "ruled out";
      // V2 2.4: a city with no council rules: nothing is ruled in or out.
      const unchecked = o.legal === "not checked";
      const unknown = !out && !unchecked && o.legal !== "not ruled out";
      const cautions = Array.isArray(o.cautions) ? (o.cautions as string[]) : [];
      if (unchecked) return <Fact flush icon="legal" tone="legal" title="Local busking rules not checked" sub="Check with the city before you play." />;
      return (
        <Fact flush icon={out ? "restricted" : "legal"} tone="legal" title={out ? "Ruled out by the council's busking rules" : unknown ? "The rules are unavailable right now" : "Not ruled out for your permit"}>
          <Cautions items={cautions} />
        </Fact>
      );
    },
  },
  score_pitches: {
    doing: () => "Scoring every pitch your permit allows",
    title: (s) => {
      const add = rec(s.input).add;
      return Array.isArray(add) && add.length > 0 ? "New pitches scored" : "Your best pitches so far";
    },
    render: (o, _s, ctx) => {
      const list = arr(o.pitches).slice(0, 3);
      return (
          <ol className="m-0 grid list-none gap-2 p-0">
            {list.map((p, i) => (
              <PitchRow
                key={str(p.pitchId) ?? i}
                rank={i + 1}
                name={str(p.name) ?? "Pitch"}
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
                <ScoreCell value={num(scores[name])} size="md" label="Score" />
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
      <ol className="m-0 list-none p-0">
        {arr(o.songs).slice(0, 4).map((x, i) => (
          <SongRow
            key={`${str(x.song)}${i}`}
            compact
            index={i + 1}
            title={str(x.song) ?? ""}
            artist={str(x.artist) ?? ""}
            year={num(x.year)}
            score={num(x.score)}
            scoreLabel="Fit"
            className="border-t border-border first:border-t-0"
            {...reasonSlots(str(x.why), str(x.artist) ? [mentionArtist(str(x.artist) as string)] : [])}
          />
        ))}
      </ol>
    ),
  },
  learn_these: {
    doing: () => "Finding songs worth learning",
    title: () => "Songs worth learning",
    render: (o) => (
      <div className="border-2 border-t-4 border-rule border-t-primary p-4">
        <ol className="m-0 list-none p-0">
          {arr(o.songs).slice(0, 3).map((x, i) => (
            <SongRow
              key={`${str(x.artist)}${i}`}
              compact
              title={str(x.title) ?? "Any song"}
              artist={str(x.artist) ?? ""}
              tags={<SongTag kind="suggested" />}
              {...reasonSlots(str(x.why), str(x.artist) ? [mentionArtist(str(x.artist) as string)] : [])}
              actions={str(x.title) ? <SongActions title={str(x.title) as string} artist={str(x.artist) ?? ""} size="sm" learnIt /> : undefined}
            />
          ))}
        </ol>
      </div>
    ),
  },
  best_hours: {
    doing: () => "Reading the forecast for your slot",
    title: () => "The best hours at each pitch",
    render: (o) => {
      const pitches = arr(o.pitches);
      if (!pitches.length) return <Foot>No busking hours are left on that day.</Foot>;
      return (
          <ul className="m-0 grid list-none gap-2 p-0" data-testid="best-hours">
            {pitches.map((p) => {
              const top = arr(p.windows)[0];
              const event = top ? arr(top.events)[0] : undefined;
              const activity = top ? num(top.activity) : null;
              const rain = top ? num(top.rainPercent) : null;
              const parts = [
                activity !== null && str(p.activityBasis) !== "none" ? `${activityWord(activity).toLowerCase()} (est.)` : null,
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
      );
    },
  },
  finish_plan: {
    doing: () => "Putting your busk together",
    title: (s) => (s.status === "failed" ? "Sent back to check more" : "Your busk is ready"),
    render: (_o, s, ctx) =>
      s.status === "failed" ? <Foot>Busk Map asked {ctx.model === "mock" ? "the test model" : "the Hive"} to look closer before answering.</Foot> : null,
  },
};

/** The signal each plan tool reads, for its level word beside the step title (V2 2.2). */
export const TOOL_SIGNAL: Partial<Record<string, LevelSignal>> = {
  compare_areas: "taste",
  taste_map: "taste",
  crowd_at: "taste",
  busy_places: "taste",
  compare_crowds: "taste",
  events_near: "events",
  activity_at: "activity",
  check_pitch: "rules",
};

/** The DS icon for each tool's cell; an unknown tool gets the dots glyph. */
/** The data sources each tool reads, drawn as their marks after the step title (U17). The Hive's own summary step has none. */
export const TOOL_SOURCES: Record<string, MentionSource[]> = {
  compare_areas: ["qloo"],
  taste_map: ["qloo"],
  crowd_at: ["qloo"],
  busy_places: ["qloo"],
  activity_at: ["qloo"],
  compare_crowds: ["qloo"],
  build_setlist: ["qloo", "lastfm", "spotify"],
  learn_these: ["qloo", "lastfm"],
  match_playlist: ["qloo"],
  related_artists: ["qloo"],
  rising: ["qloo"],
  crowd_profile: ["qloo"],
  top_tracks: ["spotify", "lastfm"],
  research_profile: ["spotify"],
  research_songs: ["spotify", "lastfm"],
  research_qloo: ["qloo"],
  research_sounds_like: ["qloo"],
  research_fans: ["qloo"],
  research_fans_map: ["qloo"],
  research_fans_love: ["qloo"],
  research_genres: ["qloo"],
  research_learn: ["qloo", "spotify"],
};

/**
 * The sources a step shows: the one it ran on when that is known (a live `tool-source` event, or the `source` its output names,
 * e.g. songs that came from Last.fm only), else every source its tool can read. One source puts that source in the running
 * mark's centre cell; more than one keeps the plain mark.
 */
export function stepSources(step: { tool: string | null; via?: MentionSource; output?: unknown }): MentionSource[] {
  const all = step.tool ? (TOOL_SOURCES[step.tool] ?? []) : [];
  const said = step.output !== null && typeof step.output === "object" ? (step.output as { source?: unknown }).source : undefined;
  const one = step.via ?? all.find((s) => s === said);
  return one && all.includes(one) ? [one] : all;
}

export const TOOL_ICON: Record<string, IconName> = {
  compare_areas: "map",
  taste_map: "map",
  crowd_at: "users",
  busy_places: "store",
  events_near: "ticket",
  activity_at: "footfall",
  check_pitch: "legal",
  score_pitches: "pin",
  compare_crowds: "users",
  build_setlist: "list",
  learn_these: "learn",
  best_hours: "clock",
  finish_plan: "check",
  // Learn run (U09: each step its own icon, never the working dots once done).
  related_artists: "users",
  rising: "trending",
  crowd_profile: "users",
  top_tracks: "music",
  finish_suggestions: "check",
  // Repertoire research.
  research_profile: "spotify",
  research_songs: "music",
  research_qloo: "search",
  research_sounds_like: "users",
  research_fans: "footfall",
  research_fans_map: "map",
  research_fans_love: "trending",
  research_learn: "learn",
  research_genres: "list",
  research_summary: "pencil",
};
