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

/** Space kept between the trace panel's top edge and a piece the browser scrolls into view above it. */
const PANEL_GAP_PX = 16;
/** The least room kept below a focused piece while tracing (the folded panel is about 63 px tall). */
const MIN_SCROLL_PADDING_PX = 96;

/**
 * While the sticky trace panel is shown, the page's scroll-padding-bottom matches its height plus a gap (at least
 * 96 px), so the browser scrolls a newly focused piece to just above the panel instead of under it (WCAG 2.2 2.4.11,
 * B-015). Focus scrolling and scrollIntoView both honour scroll-padding on the scroll container, which here is <html>.
 * The panel only ever shrinks while a piece has focus (it folds, see TracedPanel), so the padding in force when focus
 * scrolls is never smaller than the panel that ends up over the page.
 */
function useScrollPaddingBelow(panel: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    const set = () => {
      // Under 768 px the fixed bottom nav sits under the panel (the panel's `bottom` is the nav's height), so it counts too.
      const nav = document.querySelector("[data-mobile-nav]")?.getBoundingClientRect().height ?? 0;
      root.style.scrollPaddingBottom = `${Math.max(MIN_SCROLL_PADDING_PX, Math.ceil(el.getBoundingClientRect().height + nav) + PANEL_GAP_PX)}px`;
    };
    set();
    const observer = new ResizeObserver(set);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.scrollPaddingBottom = previous;
    };
  }, [panel]);
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

  const HEX = "[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]";
  const node = (id: NodeId, label: string, sub: string, num?: string, secondary = false, feature = false) => (
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
          "group flex min-h-12 w-full items-center gap-3 border-[1.5px] px-3 py-2 text-left text-sm transition-colors outline-none hover:border-qloo focus-visible:focus-ring motion-reduce:transition-none",
          feature ? "min-h-[52px]" : "",
          secondary && stateOf(id) === "none" && "border-dashed border-input",
          {
            none: secondary ? "bg-transparent text-muted-foreground" : "border-border bg-card text-card-foreground",
            selected: "border-2 border-primary bg-accent text-accent-foreground shadow-[4px_4px_0_var(--primary)]",
            path: "border-2 border-primary bg-card text-card-foreground",
            dim: "border-border bg-muted text-muted-foreground",
          }[stateOf(id)],
        )}
      >
        {num && (
          <span
            aria-hidden="true"
            className={cn(
              "grid h-[34px] w-[30px] shrink-0 place-items-center font-mono text-xs font-bold",
              HEX,
              stateOf(id) === "dim" ? "bg-border text-muted-foreground" : "bg-qloo text-bluestone",
            )}
          >
            {num}
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span className={cn(feature ? "font-display text-[21px] leading-6 font-extrabold uppercase" : "text-[15px] leading-5 font-bold", secondary && stateOf(id) === "none" && "font-normal")}>
            {num && <span className="sr-only">{num}. </span>}
            {label}
          </span>
          <span className={cn("truncate font-mono text-[11px] leading-[15px]", stateOf(id) === "dim" ? "text-muted-foreground" : num ? "text-qloo" : "text-muted-foreground")}>{sub}</span>
        </span>
      </button>
    </li>
  );

  const onPathSources = secondarySources.some((s) => !lit || lit.nodes.has(s.id));

  return (
    <section aria-labelledby="wiring" className="group/brain space-y-4" onKeyDown={onKeyDown}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 id="wiring" className="m-0 font-display text-[clamp(36px,5vw,56px)] leading-[0.92] font-extrabold uppercase">
          The wiring
        </h2>
        <ul aria-label="Legend" className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0 font-mono text-xs leading-4 font-medium text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="h-[3px] w-[22px] bg-qloo" />
            Qloo
          </li>
          <li className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="w-[22px] border-t-2 border-dashed border-muted-foreground" />
            Spotify, Ticketmaster
          </li>
          <li className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="h-[3px] w-[22px] bg-primary" />
            The path you picked
          </li>
        </ul>
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
                  on ? "stroke-primary" : secondary ? "stroke-muted-foreground" : "stroke-qloo",
                  on ? "opacity-100" : lit ? "opacity-15" : "opacity-60",
                )}
                strokeWidth={on ? 3 : 1.5}
              />
            );
          })}
        </svg>

        <Column title="Qloo calls" note={`${callKinds} kinds`} mark="bg-qloo">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Qloo calls">
            {calls.map((c) => node(c.id, c.label, `${c.endpoint}${c.urnType ? ` · ${c.urnType}` : ""}`, c.num))}
          </ul>
          <div className={cn("space-y-2 pt-3", !onPathSources && "max-lg:hidden")}>
            <h4 className="m-0 font-mono text-[11px] leading-[14px] font-bold tracking-[0.08em] text-muted-foreground uppercase">With two other sources</h4>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Other sources">
              {secondarySources.map((s) => node(s.id, s.label, s.contributes, undefined, true))}
            </ul>
          </div>
        </Column>

        <Column title="Data points" note="what comes back" mark="bg-foreground">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Data points">
            {dataPoints.map((d) => node(d.id, d.label, d.sub))}
          </ul>
        </Column>

        <Column title="Your busk" note={`${featureCount} parts it decides`} mark="bg-primary">
          <ul className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-1 lg:flex-col lg:justify-between" aria-label="Your busk">
            {features.map((f) => node(f.id, f.label, f.sub, undefined, false, true))}
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

function Column({ title, note, mark, children }: { title: string; note: string; mark: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="m-0 flex h-10 items-center gap-2.5 font-display text-[22px] leading-none font-extrabold uppercase">
        <span aria-hidden="true" className={cn("h-7 w-6 shrink-0 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]", mark)} />
        {title}
        <span className="font-mono text-xs font-medium tracking-normal text-muted-foreground normal-case">{note}</span>
      </h3>
      {children}
    </div>
  );
}

function TracePanel({ selected, onClear }: { selected: NodeId | null; onClear: () => void }) {
  return selected ? <TracedPanel selected={selected} onClear={onClear} /> : <IdlePanel />;
}

function IdlePanel() {
  return (
    <div className="border-2 border-qloo bg-popover p-4 text-sm" data-testid="trace-panel">
      <p className="m-0 font-display text-[22px] leading-none font-extrabold uppercase">Pick any piece</p>
      <p className="m-0 mt-2 text-sm leading-5 text-muted-foreground">
        Choose a Qloo call, a data point or a part of your busk, and its whole path lights up. Try Setlist and learn these, where four
        Qloo calls and Spotify meet.
      </p>
    </div>
  );
}

/**
 * The open trace: sticky at the bottom of the viewport, so the page keeps scroll padding for it while it's shown, and
 * folded to the name and Clear trace while a piece has keyboard focus.
 */
function TracedPanel({ selected, onClear }: { selected: NodeId; onClear: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollPaddingBelow(ref);
  const { nodes } = trace(selected);
  const isFeature = nodeKind(selected) === "feature";
  const reach = [...nodes].filter((id) => id !== selected && (isFeature ? ["call", "source"] : ["feature"]).includes(nodeKind(id)));
  const links = edges.flatMap((e) =>
    e.to === selected ? [{ dir: "From", name: nodeLabel(e.from), how: e.how }] : e.from === selected ? [{ dir: "To", name: nodeLabel(e.to), how: e.how }] : [],
  );
  return (
    <div
      ref={ref}
      className="sticky bottom-(--bottom-nav) z-10 max-h-[45vh] space-y-2 overflow-auto border-2 border-qloo bg-popover p-4 text-sm text-popover-foreground shadow-lg"
      data-testid="trace-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 font-display text-[22px] leading-none font-extrabold text-qloo uppercase">{nodeLabel(selected)}</p>
        <Button type="button" variant="outline" onClick={onClear}>
          Clear trace
        </Button>
      </div>
      {/* Keyboard users tabbing through the pieces get a slim bar (name and Clear trace) so the panel covers less of the
          page; the details come back when focus leaves the pieces. Mouse clicks don't match :focus-visible. */}
      <div className="space-y-2 group-has-[[data-node-id]:focus-visible]/brain:hidden" data-testid="trace-detail">
        <p className="m-0 font-mono text-[13px] leading-[18px] text-muted-foreground">{traceSummary(selected)}</p>
        {reach.length > 0 && (
          <p className="m-0">
            <b className="text-qloo">{isFeature ? "Comes from:" : "Decides:"}</b> {reach.map(nodeLabel).join(" · ")}
          </p>
        )}
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {links.map((l) => (
            <li key={`${l.dir}-${l.name}`} className="flex gap-2">
              <span aria-hidden="true" className="mt-[3px] h-3.5 w-2 shrink-0 bg-primary [clip-path:polygon(0_0,50%_0,100%_50%,50%_100%,0_100%)]" />
              <span>
                <b>
                  {l.dir} {l.name}
                </b>
                : {l.how}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
