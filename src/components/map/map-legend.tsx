/** The map's key: what the shading and the pins mean. */
export function MapLegend({ testData }: { testData: boolean }) {
  return (
    <div className="space-y-2 text-xs text-muted-foreground" aria-label="Map legend">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">Taste map (Qloo heatmap{testData ? ", test data" : ""})</span>
        <span>weaker</span>
        <span className="h-2.5 w-24 rounded-sm border bg-linear-to-r from-transparent to-foreground/45" aria-hidden />
        <span>stronger match for your artists</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] text-primary-foreground" aria-hidden>
            1
          </span>
          Top pitch
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rotate-45 rounded-[2px] bg-primary" aria-hidden />
          Hidden gem
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/70" aria-hidden />
          Other scored pitch
        </span>
      </div>
    </div>
  );
}
