const HEX = "[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]";
const LINK = "[clip-path:polygon(0_0,50%_0,100%_50%,50%_100%,0_100%)]";

/**
 * The landing's brain teaser sketch (user, impeccable live 17 Oct): the brain's real shape as dense bands of cells, 11 Qloo
 * calls, 16 data points and 8 parts of your busk, under big display labels and joined by the F30 half-hex links.
 * A sketch, not data: hidden from screen readers (the teaser's numbers and copy carry the meaning).
 */
const COLUMNS = [
  { label: "Calls", n: 11, tone: (k: number) => (k % 3 === 1 ? "bg-primary" : "bg-qloo") },
  { label: "Data", n: 16, tone: (k: number) => (k % 4 === 0 ? "bg-muted" : "bg-primary") },
  { label: "Busk", n: 8, tone: (k: number) => (k % 2 === 0 ? "bg-primary" : "bg-muted") },
];

export function BrainSketch() {
  return (
    <div aria-hidden="true" className="box-border flex max-w-full min-w-0 flex-[0_1_340px] items-stretch justify-center gap-2.5 border-[1.5px] border-border bg-card p-4">
      {COLUMNS.map((col, i) => (
        <div key={col.label} className="contents">
          {i > 0 ? <span className={`h-[18px] w-3 self-center bg-primary ${LINK}`} /> : null}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="font-display text-[22px] leading-none font-extrabold uppercase">{col.label}</span>
            <div className="grid grid-cols-2 gap-1">
              {Array.from({ length: col.n }, (_, k) => (
                <span key={k} className={`h-4 w-3.5 ${HEX} ${col.tone(k)}`} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
