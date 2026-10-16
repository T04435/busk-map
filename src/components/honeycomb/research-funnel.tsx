import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Loader } from "@/components/honeycomb/loader";
import type { ResearchTotals } from "@/lib/research-totals";

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}K` : String(n));

type Stage = { key: keyof ResearchTotals; one: string; many: string; src: string; tool: string };
const STAGES: Stage[] = [
  { key: "qlooCalls", one: "Qloo call", many: "Qloo calls", src: "Qloo", tool: "_qloo" },
  { key: "taste", one: "taste cell mapped", many: "taste cells mapped", src: "Qloo", tool: "taste_map" },
  { key: "crowds", one: "crowd read", many: "crowds read", src: "Qloo", tool: "crowd_at" },
  { key: "places", one: "busy place", many: "busy places", src: "Qloo", tool: "busy_places" },
  { key: "events", one: "event", many: "events", src: "Ticketmaster", tool: "events_near" },
  { key: "sensors", one: "sensor count", many: "sensor counts", src: "City of Melbourne", tool: "footfall_at" },
  { key: "rules", one: "rules check", many: "rules checks", src: "City of Melbourne", tool: "check_pitch" },
  { key: "scored", one: "pitch scored", many: "pitches scored", src: "Busk Map", tool: "score_pitches" },
  { key: "songs", one: "song ordered", many: "songs ordered", src: "Qloo · Last.fm", tool: "build_setlist" },
];

/** What the research looked at, counted from the run, as a chain of honeycomb cells. Fills in live and stays once the busk is ready. */
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
  className?: string;
}) {
  const t = totals ?? {};
  const stages = STAGES.filter((s) => (t[s.key] ?? 0) > 0 || running.includes(s.tool));
  const total = STAGES.reduce((sum, s) => (s.key === "qlooCalls" ? sum : sum + (t[s.key] ?? 0)), 0);
  const done = !live && picks !== null;
  const items: React.ReactNode[] = [];
  const link = (k: string) => (
    <li key={`${k}-l`} aria-hidden="true" className="hidden h-0.5 w-3 bg-rule sm:block" />
  );
  stages.forEach((s) => {
    const n = t[s.key] ?? 0;
    const busy = running.includes(s.tool) && n === 0;
    items.push(
      <li key={s.key} title={s.src} className="flex min-w-[88px] flex-col items-center gap-1 text-center text-[13px] leading-4">
        <HexCell size={36} tone={busy ? "dashed" : "default"} fontSize={String(n).length > 3 ? 11 : 14} label={busy ? `${s.many}: checking` : `${n} ${n === 1 ? s.one : s.many} (${s.src})`}>
          {busy ? <Loader size={14} /> : fmt(n)}
        </HexCell>
        <span aria-hidden="true">{n === 1 ? s.one : s.many}</span>
      </li>,
      link(s.key),
    );
  });
  items.push(
    <li key="total" className="flex min-w-[88px] flex-col items-center gap-1 text-center text-[13px] leading-4 font-bold">
      <HexCell size={42} fontSize={14} label={`${total} data points`}>
        {fmt(total)}
      </HexCell>
      <span aria-hidden="true">data points</span>
    </li>,
    link("total"),
    <li key="picks" className="flex min-w-[88px] flex-col items-center gap-1 text-center text-[13px] leading-4 font-bold">
      <HexCell size={42} tone={done ? "primary" : "dashed"} fontSize={16} label={done ? `${picks} pitches for your busk` : "Choosing your pitches"}>
        {done ? picks : <Loader size={16} />}
      </HexCell>
      <span aria-hidden="true">{done ? (picks === 1 ? "pitch" : "pitches") : "choosing pitches"}</span>
    </li>,
  );
  return (
    <section aria-label="The data behind your busk" aria-live={live ? "polite" : "off"} className={cn("border-2 border-rule bg-card p-4", className)}>
      <ol className="m-0 flex list-none flex-wrap items-start justify-start gap-x-2 gap-y-4 p-0">{items}</ol>
    </section>
  );
}
