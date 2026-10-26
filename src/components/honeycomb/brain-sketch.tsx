import { callKinds, dataPointCount, featureCount } from "@/lib/qloo-map";

const HEX = "[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]";
const LINK = "[clip-path:polygon(0_0,50%_0,100%_50%,50%_100%,0_100%)]";

/**
 * The landing's brain teaser sketch (user, impeccable live 17 Oct): the brain's real shape as dense bands of cells, one per kind
 * of Qloo call, data point and part of your busk (counted from lib/qloo-map, never typed in), under big display labels and joined by the F30 half-hex links. A pulse runs
 * through every cell, calls to busk, on a loop that never stops (hc-flow in globals.css; still under reduced motion).
 * A sketch, not data: hidden from screen readers (the teaser's numbers and copy carry the meaning).
 */
const COLUMNS = [
  { label: "Calls", n: callKinds, tone: (k: number) => (k % 3 === 1 ? "bg-primary" : "bg-slate") },
  { label: "Data", n: dataPointCount, tone: (k: number) => (k % 4 === 0 ? "bg-muted" : "bg-primary") },
  { label: "Busk", n: featureCount, tone: (k: number) => (k % 2 === 0 ? "bg-primary" : "bg-muted") },
];

export function BrainSketch() {
  return (
    <div aria-hidden="true" className="box-border flex max-w-full min-w-0 flex-[0_1_340px] items-stretch justify-center gap-2.5 border-[1.5px] border-border bg-card p-4">
      {COLUMNS.map((col, i) => (
        <div key={col.label} className="contents">
          {i > 0 ? <span className={`hc-flow-link h-[18px] w-3 self-center bg-primary ${LINK}`} style={{ "--c": i } as React.CSSProperties} /> : null}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="font-display text-[22px] leading-none font-extrabold uppercase">{col.label}</span>
            <div className="grid grid-cols-2 gap-1">
              {Array.from({ length: col.n }, (_, k) => (
                <span
                  key={k}
                  className={`hc-flow-cell h-4 w-3.5 ${HEX} ${col.tone(k)}`}
                  style={{ "--g": COLUMNS.slice(0, i).reduce((t, c) => t + c.n, 0) + k } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
