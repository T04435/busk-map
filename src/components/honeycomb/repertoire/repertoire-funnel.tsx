import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Loader } from "@/components/honeycomb/loader";
import type { RepertoireTotals } from "./types";

/** The DS formatCount: 1.2K, 12K, 3.4M. Counts under 1000 stay as they are. */
const fmt = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`
    : n >= 1e3
      ? `${Math.round(n / 1e3)}K`
      : String(n);

type CountKey = Exclude<keyof RepertoireTotals, "toLearn">;
type Stage = { key: CountKey; one: string; many: string; src: string; qloo?: boolean };
const STAGES: Stage[] = [
  { key: "qlooCalls", one: "Qloo call", many: "Qloo calls", src: "Qloo", qloo: true },
  { key: "songs", one: "song loaded", many: "songs loaded", src: "Spotify" },
  { key: "soundsLike", one: "artist you sound like", many: "artists you sound like", src: "Qloo" },
  { key: "fanArtists", one: "fan artist", many: "fan artists", src: "Qloo" },
  { key: "songsChecked", one: "song checked", many: "songs checked", src: "Spotify" },
];

const CELL = "font-mono font-bold tabular-nums text-foreground";
const STEP = "inline-flex items-center gap-1.5 text-[13px] leading-4 text-muted-foreground";

/**
 * What the Repertoire research looked at, as the same inline honeycomb row as the busk ResearchFunnel: a 30px cell per stage with
 * its count and label, joined by the orange half-hex link, ending in the orange "songs to learn" cell.
 */
export function RepertoireFunnel({ totals, live, className }: { totals: Partial<RepertoireTotals> | null; live: boolean; className?: string }) {
  const t = totals ?? {};
  const stages = STAGES.filter((s) => (t[s.key] ?? 0) > 0);
  const toLearn = t.toLearn ?? null;
  const ready = toLearn !== null;
  const choosing = !ready && live;
  const items: React.ReactNode[] = [];
  const link = (k: string) => (
    <li key={`${k}-l`} aria-hidden="true" className="px-1">
      <span className="block h-[18px] w-3 bg-primary [clip-path:polygon(0_0,50%_0,100%_50%,50%_100%,0_100%)]" />
    </li>
  );
  stages.forEach((s) => {
    const n = t[s.key] ?? 0;
    const text = fmt(n);
    const name = n === 1 ? s.one : s.many;
    items.push(
      <li key={s.key} title={s.src} className={STEP}>
        <HexCell size={30} fontSize={text.length > 3 ? 10 : 12} className={cn(CELL, s.qloo && "text-qloo")} label={`${n} ${name} (${s.src})`}>
          {text}
        </HexCell>
        <span>{name}</span>
      </li>,
      link(s.key),
    );
  });
  if (ready || choosing) {
    const text = fmt(toLearn ?? 0);
    items.push(
      <li key="learn" className={cn(STEP, "text-sm font-bold text-foreground")}>
        <HexCell
          size={34}
          tone={ready ? "primary" : "dashed"}
          fontSize={ready && text.length > 3 ? 10 : 12}
          className={CELL}
          label={ready ? `${toLearn} ${toLearn === 1 ? "song" : "songs"} to learn` : "Choosing songs to learn"}
        >
          {ready ? text : <Loader size={14} label="Choosing" className="bm-loader-think text-primary" />}
        </HexCell>
        <span className={ready ? "text-signal-text" : "font-normal text-muted-foreground"}>
          {ready ? (toLearn === 1 ? "song to learn" : "songs to learn") : "choosing songs"}
        </span>
      </li>,
    );
  } else if (items.length) {
    items.pop(); // no trailing link without an end cell
  }
  return (
    <section aria-label="The data behind your Repertoire" aria-live={live ? "polite" : "off"} className={className}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-1.5 p-0">{items}</ol>
    </section>
  );
}
