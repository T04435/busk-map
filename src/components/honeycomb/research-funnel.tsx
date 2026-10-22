import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Spinner } from "@/components/ui/spinner";
import type { ResearchTotals } from "@/lib/research-totals";

/** The DS formatCount: 1.2K, 12K, 3.4M. Counts under 1000 stay as they are. */
const fmt = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`
    : n >= 1e3
      ? `${Math.round(n / 1e3)}K`
      : String(n);

type Stage = { key: keyof ResearchTotals; one: string; many: string; src: string; tool: string };
const STAGES: Stage[] = [
  { key: "qlooCalls", one: "Qloo call", many: "Qloo calls", src: "Qloo", tool: "_qloo" },
  { key: "taste", one: "taste cell mapped", many: "taste cells mapped", src: "Qloo", tool: "taste_map" },
  { key: "crowds", one: "crowd read", many: "crowds read", src: "Qloo", tool: "crowd_at" },
  { key: "places", one: "busy place", many: "busy places", src: "Qloo", tool: "busy_places" },
  { key: "events", one: "event", many: "events", src: "Ticketmaster", tool: "events_near" },
  { key: "activity", one: "activity estimate", many: "activity estimates", src: "Qloo", tool: "activity_at" },
  { key: "rules", one: "rules check", many: "rules checks", src: "City of Melbourne", tool: "check_pitch" },
  { key: "scored", one: "pitch scored", many: "pitches scored", src: "Busk Map", tool: "score_pitches" },
  { key: "songs", one: "song ordered", many: "songs ordered", src: "Qloo · Last.fm", tool: "build_setlist" },
];

/** The count inside a cell: mono, bold, tabular. */
const CELL = "font-mono font-bold tabular-nums text-foreground";
/** One step: a cell with its label beside it. */
const STEP = "inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-4 text-muted-foreground";

/**
 * What the research looked at, counted from the run, as an inline row of honeycomb cells (ported 1:1 from the DS ResearchFunnel).
 * Each step is a 30px cell with its count and the label beside it, joined by a signal half-hex link, adding up to the data-points
 * cell, then the pitches cell. Fills in live and stays once the busk is ready.
 */
export function ResearchFunnel({
  totals,
  running = [],
  live,
  picks,
  className,
}: {
  totals: Partial<ResearchTotals> | null;
  /** Tools that are working now: their cell shows a dashed loader until the count arrives. */
  running?: string[];
  live: boolean;
  /** Number of pitches in the busk once it is ready (null while choosing). */
  picks: number | null;
  /** Kept for callers; ignored. There is one layout (the DS's inline row). */
  layout?: "stacked" | "landing";
  className?: string;
}) {
  const t = totals ?? {};
  const stages = STAGES.filter((s) => (t[s.key] ?? 0) > 0 || running.includes(s.tool));
  const total = STAGES.reduce((sum, s) => (s.key === "qlooCalls" ? sum : sum + (t[s.key] ?? 0)), 0);
  const done = !live && picks !== null;
  const items: React.ReactNode[] = [];
  const link = (k: string) => (
    <li key={`${k}-l`} aria-hidden="true" className="px-1">
      <span className="block h-[18px] w-3 bg-primary [clip-path:polygon(0_0,50%_0,100%_50%,50%_100%,0_100%)]" />
    </li>
  );
  stages.forEach((s) => {
    const n = t[s.key] ?? 0;
    const busy = running.includes(s.tool) && n === 0;
    const text = fmt(n);
    const name = n === 1 ? s.one : s.many;
    items.push(
      <li key={s.key} className={STEP}>
        <HexCell size={30} tone={busy ? "dashed" : "default"} fontSize={text.length > 3 ? 10 : 12} className={CELL} label={busy ? `${s.many}: checking` : `${n} ${name} (${s.src})`}>
          {busy ? <Spinner size={14} label="Checking" aria-hidden="true" className="text-primary" /> : text}
        </HexCell>
        <span>{name}</span>
      </li>,
      link(s.key),
    );
  });
  const totalText = fmt(total);
  items.push(
    <li key="total" className={cn(STEP, "text-sm font-bold text-foreground")}>
      <HexCell size={34} fontSize={totalText.length > 3 ? 10 : 12} className={CELL} label={`${total} data points`}>
        {totalText}
      </HexCell>
      <span>data points</span>
    </li>,
    link("total"),
    <li key="picks" className={cn(STEP, "text-sm font-bold text-foreground")}>
      <HexCell size={34} tone={done ? "primary" : "dashed"} fontSize={done && String(picks).length > 3 ? 10 : 12} className={CELL} label={done ? `${picks} pitches for your busk` : "Choosing your pitches"}>
        {done ? picks : <Spinner size={14} label="Checking" aria-hidden="true" className="bm-loader-think text-primary" />}
      </HexCell>
      <span className={live ? "font-normal text-muted-foreground" : "text-signal-text"}>{done ? "pitches" : "choosing pitches"}</span>
    </li>,
  );
  return (
    <section aria-label="The data behind your busk" aria-live={live ? "polite" : "off"} className={className}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-1.5 p-0">{items}</ol>
    </section>
  );
}
