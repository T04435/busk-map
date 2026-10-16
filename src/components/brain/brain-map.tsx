"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  callKinds,
  calls,
  dataPoints,
  edges,
  featureCount,
  features,
  nodeKind,
  nodeLabel,
  secondarySources,
  trace,
  traceSummary,
  type NodeId,
} from "@/lib/qloo-map";

type TraceState = "none" | "selected" | "path" | "dim";

/** Three columns from 1024 px up (Tailwind's lg); at 1023 px and below the columns stack. */
const WIDE = "(min-width: 1024px)";

/**
 * Lines between the columns, measured from the node buttons (wide layout only). Remeasured whenever the grid
 * resizes (fonts, viewport); a trace doesn't move anything in the wide layout, so it only restyles the lines.
 */
function useWires(grid: React.RefObject<HTMLDivElement | null>, nodes: React.RefObject<Map<NodeId, HTMLElement>>) {
  const [paths, setPaths] = useState<{ index: number; d: string }[]>([]);
  useEffect(() => {
    const box = grid.current;
    if (!box) return;
    const wide = window.matchMedia(WIDE);
    const measure = () => {
      if (!wide.matches) return setPaths([]);
      const g = box.getBoundingClientRect();
      setPaths(
        edges.flatMap((e, index) => {
          const a = nodes.current.get(e.from)?.getBoundingClientRect();
          const b = nodes.current.get(e.to)?.getBoundingClientRect();
          if (!a || !b) return [];
          const x1 = a.right - g.left;
          const y1 = a.top + a.height / 2 - g.top;
          const x2 = b.left - g.left;
          const y2 = b.top + b.height / 2 - g.top;
          const mid = (x1 + x2) / 2;
          return [{ index, d: `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}` }];
        }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    wide.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      wide.removeEventListener("change", measure);
    };
  }, [grid, nodes]);
  return paths;
}

export function BrainMap() {
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<NodeId, HTMLElement>());
  const paths = useWires(gridRef, nodeRefs);
  const lit = useMemo(() => (selected ? trace(selected) : null), [selected]);

  const stateOf = (id: NodeId): TraceState => (!lit ? "none" : id === selected ? "selected" : lit.nodes.has(id) ? "path" : "dim");

  const pick = (id: NodeId) => {
    if (selected === id) return clear();
    setSelected(id);
    setAnnouncement(`Tracing. ${traceSummary(id)} Other pieces are dimmed.`);
  };
  const clear = () => {
    const was = selected;
    setSelected(null);
    setAnnouncement("Trace cleared. Every piece is shown.");
    // The Clear button goes away with the trace: put focus back on the piece that was traced.
    if (was) nodeRefs.current.get(was)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && selected) clear();
  };

  const node = (id: NodeId, label: string, sub: string, num?: string, secondary = false) => (
    <li key={id} className={cn(stateOf(id) === "dim" && "max-lg:hidden")}>
      <button
        type="button"
        ref={(el) => {
          if (el) nodeRefs.current.set(id, el);
          else nodeRefs.current.delete(id);
        }}
        aria-pressed={selected === id}
        data-node-id={id}
        data-trace={stateOf(id)}
        onClick={() => pick(id)}
        className={cn(
          "group flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
          secondary && "border-dashed",
          {
            none: secondary ? "bg-transparent text-muted-foreground hover:bg-muted" : "bg-card text-card-foreground hover:bg-muted",
            selected: "border-primary bg-primary text-primary-foreground",
            path: "border-foreground bg-card text-foreground ring-1 ring-foreground",
            dim: "border-border/60 bg-transparent text-muted-foreground hover:bg-muted",
          }[stateOf(id)],
        )}
      >
        {num && (
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md border border-current/30 font-mono text-xs"
          >
            {num}
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span className={cn("font-medium", secondary && stateOf(id) === "none" && "font-normal")}>
            {num && <span className="sr-only">{num}. </span>}
            {label}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground group-data-[trace=selected]:text-primary-foreground/80">{sub}</span>
        </span>
      </button>
    </li>
  );

  const onPathSources = secondarySources.some((s) => !lit || lit.nodes.has(s.id));

  return (
    <section aria-labelledby="wiring" className="space-y-4" onKeyDown={onKeyDown}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="wiring" className="text-2xl font-semibold tracking-tight">
          The wiring
        </h2>
        <p className="text-sm text-muted-foreground">Pick any piece to trace its path. Dashed: Spotify and Ticketmaster, the other sources.</p>
      </div>

      <div ref={gridRef} className="relative grid gap-8 lg:grid-cols-3 lg:gap-x-16" data-testid="brain-grid">
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden size-full overflow-visible lg:block">
          {paths.map(({ index, d }) => {
            const on = lit?.edges.has(index);
            const secondary = nodeKind(edges[index].from) === "source";
            return (
              <path
                key={index}
                d={d}
                fill="none"
                strokeDasharray={secondary ? "4 3" : undefined}
                className={cn(
                  "transition-opacity motion-reduce:transition-none",
                  on ? "stroke-foreground" : "stroke-muted-foreground",
                  on ? "opacity-100" : lit ? "opacity-10" : "opacity-30",
                )}
                strokeWidth={on ? 2 : 1}
              />
            );
          })}
        </svg>

        <Column title="Qloo calls" note={`${callKinds} kinds`}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Qloo calls">
            {calls.map((c) => node(c.id, c.label, `${c.endpoint}${c.urnType ? ` · ${c.urnType}` : ""}`, c.num))}
          </ul>
          <div className={cn("space-y-2 pt-3", !onPathSources && "max-lg:hidden")}>
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">With two other sources</h4>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Other sources">
              {secondarySources.map((s) => node(s.id, s.label, s.contributes, undefined, true))}
            </ul>
          </div>
        </Column>

        <Column title="Data points" note="what comes back">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Data points">
            {dataPoints.map((d) => node(d.id, d.label, d.sub))}
          </ul>
        </Column>

        <Column title="Your busk" note={`${featureCount} parts it decides`}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-1 lg:flex-col lg:justify-between" aria-label="Your busk">
            {features.map((f) => node(f.id, f.label, f.sub))}
          </ul>
        </Column>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <TracePanel selected={selected} onClear={clear} />
    </section>
  );
}

function Column({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-lg font-semibold">
        {title}
        <span className="font-mono text-xs font-normal text-muted-foreground">{note}</span>
      </h3>
      {children}
    </div>
  );
}

function TracePanel({ selected, onClear }: { selected: NodeId | null; onClear: () => void }) {
  if (!selected) {
    return (
      <div className="rounded-xl border p-4 text-sm" data-testid="trace-panel">
        <p className="font-medium">Pick any piece</p>
        <p className="text-muted-foreground">
          Choose a Qloo call, a data point or a part of your busk, and its whole path lights up. Try Setlist and learn these, where four
          Qloo calls and Spotify meet.
        </p>
      </div>
    );
  }
  const { nodes } = trace(selected);
  const isFeature = nodeKind(selected) === "feature";
  const reach = [...nodes].filter((id) => id !== selected && (isFeature ? ["call", "source"] : ["feature"]).includes(nodeKind(id)));
  const links = edges.flatMap((e) =>
    e.to === selected ? [{ dir: "From", name: nodeLabel(e.from), how: e.how }] : e.from === selected ? [{ dir: "To", name: nodeLabel(e.to), how: e.how }] : [],
  );
  return (
    <div
      className="sticky bottom-0 z-10 max-h-[45vh] space-y-2 overflow-auto rounded-xl border bg-background p-4 text-sm shadow-lg"
      data-testid="trace-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{nodeLabel(selected)}</p>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          Clear trace
        </Button>
      </div>
      <p className="text-muted-foreground">{traceSummary(selected)}</p>
      {reach.length > 0 && (
        <p>
          <span className="font-medium">{isFeature ? "Comes from:" : "Decides:"}</span> {reach.map(nodeLabel).join(" · ")}
        </p>
      )}
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={`${l.dir}-${l.name}`}>
            <span className="font-medium">
              {l.dir} {l.name}
            </span>
            : {l.how}
          </li>
        ))}
      </ul>
    </div>
  );
}
