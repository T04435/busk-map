"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  callKinds,
  calls,
  dataPoints,
  edges,
  features,
  nodeKind,
  nodeLabel,
  secondarySources,
  trace,
  traceSummary,
  type NodeId,
} from "@/lib/qloo-map";

type TraceState = "none" | "selected" | "path" | "dim";

/** The board's sub-line for each call: the endpoint and what tells the calls on it apart (B-116). */
const CALL_SUB: Partial<Record<NodeId, string>> = {
  c1: "/search",
  c2: "/entities · external.spotify.ids",
  c3: "/v2/insights · urn:heatmap",
  c4: "/v2/insights · urn:entity:place",
  c5: "/v2/insights · artist · explainability",
  c5b: "/v2/insights · artist · no taste signal",
  c6: "/v2/insights · artist · signal.location",
  c7: "/v2/insights · artist · filter.results",
  c8: "/v2/trending",
  c9: "/v2/insights · urn:demographics",
  c10: "/v2/insights · urn:tag",
  c11: "/v2/analysis/compare",
};

/** The panel's summary, as the DS words it: every lit Qloo call, data point and part of the busk (the picked one too), always all three. */
function lightsUp(id: NodeId): string {
  const { nodes } = trace(id);
  const count = (kind: string) => [...nodes].filter((n) => nodeKind(n) === kind).length;
  const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return `Lights up ${pl(count("call"), "Qloo call", "Qloo calls")}, ${pl(count("dataPoint"), "data point", "data points")} and ${pl(count("feature"), "part", "parts")} of your busk.`;
}

// The DS's wire geometry: both gutters are 72 px wide and (at least) 1000 px tall, a row is 52 px + 8 px gap, and heads take 48 px.
// The columns grow past 1000 px when the map has more pieces than the DS drew (14 calls and 3 sources, 18 data points), so
// no list runs into the trace panel below.
const GUTTER_W = 72;
const ROW = 60;
const TOP = 48;
const COL_H = Math.max(1000, TOP + calls.length * ROW + 36 + secondarySources.length * ROW, TOP + dataPoints.length * ROW);
const MID = 26;
const rowY = (i: number) => TOP + i * ROW + MID;
const Y = new Map<NodeId, number>([
  ...calls.map((c, i) => [c.id, rowY(i)] as const),
  ...secondarySources.map((s, i) => [s.id, TOP + calls.length * ROW + 36 + i * ROW + MID] as const),
  ...dataPoints.map((d, i) => [d.id, rowY(i)] as const),
  ...features.map((f, i) => [f.id, TOP + i * ((COL_H - TOP - 52) / (features.length - 1)) + MID] as const),
]);
/** Wires drawn dashed grey: out of the other sources and out of the data points they alone supply. */
const OTHER_ORIGINS = new Set<NodeId>(["spotify", "ticketmaster", "lastfm", "d_events", "d_years", "d_plays"]);
const wireD = (e: { from: NodeId; to: NodeId }) => {
  const y1 = Y.get(e.from)!;
  const y2 = Y.get(e.to)!;
  return `M0 ${y1} C36 ${y1} 36 ${y2} ${GUTTER_W} ${y2} `;
};

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

const HEX = "[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]";

export function BrainMap() {
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const nodeRefs = useRef(new Map<NodeId, HTMLElement>());
  const lit = useMemo(() => (selected ? trace(selected) : null), [selected]);

  // Picking a piece opens the trace panel and, in the stacked layout, hides the dimmed pieces, so the picked piece can end up
  // under the panel or far off screen. Once that has laid out, bring it back, keeping the panel's scroll padding (B-150, B-015).
  useEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() => nodeRefs.current.get(selected)?.scrollIntoView({ block: "nearest", behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [selected]);

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

  // DS .bm-brain-node: 52 px, card fill, 1.5px border; other sources dashed and transparent; the picked one gets the orange offset shadow.
  const node = (id: NodeId, label: string, sub: string, num?: string, other = false, feature = false) => {
    const state = stateOf(id);
    const dim = state === "dim";
    return (
      <li key={id} className={cn("min-w-0", dim && "max-lg:hidden")}>
        <button
          type="button"
          ref={(el) => {
            if (el) nodeRefs.current.set(id, el);
            else nodeRefs.current.delete(id);
          }}
          aria-pressed={selected === id}
          data-node-id={id}
          data-trace={state}
          onClick={() => pick(id)}
          className={cn(
            "box-border flex h-[52px] w-full min-w-0 cursor-pointer scroll-mt-24 items-center gap-2.5 border-[1.5px] border-border bg-card px-3 text-left text-foreground transition-[border-color] duration-(--duration-fast) ease-(--ease-out) outline-2 outline-transparent outline-offset-2 hover:border-qloo focus-visible:outline-ring focus-visible:ring-0 motion-reduce:transition-none",
            other && "border-dashed bg-transparent",
            state === "path" && "border-2 border-primary",
            state === "selected" && "border-2 border-primary bg-[#26323a] shadow-[4px_4px_0_var(--primary)] outline-primary",
            dim && "bg-muted",
          )}
        >
          {num && (
            <span
              aria-hidden="true"
              className={cn("grid h-[34px] w-[30px] shrink-0 place-items-center font-mono text-xs leading-none font-bold", HEX, dim ? "bg-border text-muted-foreground" : "bg-qloo text-card")}
            >
              {num}
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <b className={cn("truncate", feature ? "font-display text-[21px] leading-6 font-extrabold uppercase" : "text-[15px] leading-5", dim && "text-muted-foreground")}>
              {num && <span className="sr-only">{num}. </span>}
              {label}
            </b>
            <span className={cn("truncate font-mono text-[11px] leading-[15px] font-medium", num && !dim ? (state === "selected" ? "text-foreground" : "text-qloo") : "text-muted-foreground")}>{sub}</span>
          </span>
        </button>
      </li>
    );
  };

  const othersHit = !lit || secondarySources.some((s) => lit.nodes.has(s.id));

  // One gutter: all Qloo wires in one path, all dashed wires in another, the lit ones on top (DS wires()).
  const gutter = (list: { index: number; from: NodeId; to: NodeId }[]) => {
    const q: string[] = [];
    const o: string[] = [];
    const on: string[] = [];
    for (const e of list) (lit?.edges.has(e.index) ? on : OTHER_ORIGINS.has(e.from) ? o : q).push(wireD(e));
    const fade = cn("fill-none stroke-[1.5] transition-opacity duration-(--duration-fast) ease-(--ease-out) motion-reduce:transition-none", lit ? "opacity-10" : "opacity-45");
    return (
      <div aria-hidden="true" className="max-lg:hidden">
        <svg viewBox={`0 0 ${GUTTER_W} ${COL_H}`} width={GUTTER_W} height={COL_H} className="block">
          <path d={q.join("") || "M0 0"} className={cn(fade, "stroke-qloo")} />
          <path d={o.join("") || "M0 0"} strokeDasharray="4 3" className={cn(fade, "stroke-muted-foreground")} />
          <path d={on.join("") || "M0 0"} className="fill-none stroke-primary stroke-[2.5]" />
        </svg>
      </div>
    );
  };
  const indexed = edges.map((e, index) => ({ index, from: e.from, to: e.to }));
  const toPoints = indexed.filter((e) => nodeKind(e.from) !== "dataPoint");
  const toFeatures = indexed.filter((e) => nodeKind(e.from) === "dataPoint");

  const listClass = "m-0 flex list-none flex-col gap-2 p-0 max-lg:grid max-lg:grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))]";

  return (
    <section aria-labelledby="wiring" className="group/brain flex flex-col gap-4" onKeyDown={onKeyDown}>
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
            Spotify, Ticketmaster, Last.fm
          </li>
          <li className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="h-[3px] w-[22px] bg-primary" />
            The path you picked
          </li>
        </ul>
      </div>

      <div data-testid="brain-grid" className="grid items-start max-lg:gap-7 lg:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)_72px_minmax(0,1fr)]">
        <Column title="Qloo calls" note={`${callKinds} kinds`} mark="bg-qloo">
          <ul className={listClass} aria-label="Qloo calls">
            {calls.map((c) => node(c.id, c.label, CALL_SUB[c.id] ?? `${c.endpoint}${c.urnType ? ` · ${c.urnType}` : ""}`, c.num))}
          </ul>
          <h4
            className={cn(
              "m-0 mt-2 mb-2 flex h-7 items-end font-mono text-[11px] leading-[14px] font-bold tracking-[0.08em] text-muted-foreground uppercase",
              !othersHit && "invisible max-lg:hidden",
            )}
          >
            With three other sources
          </h4>
          <ul className={listClass} aria-label="Other sources">
            {secondarySources.map((s) => node(s.id, s.label, s.contributes, undefined, true))}
          </ul>
        </Column>
        {gutter(toPoints)}
        <Column title="Data points" note="what comes back" mark="bg-foreground">
          <ul className={listClass} aria-label="Data points">
            {dataPoints.map((d) => node(d.id, d.label, d.sub))}
          </ul>
        </Column>
        {gutter(toFeatures)}
        <Column title="Your busk" note="what it decides" mark="bg-primary">
          <ul className={cn(listClass, "lg:flex-1 lg:justify-between")} aria-label="Your busk">
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
    <div className="flex min-w-0 flex-col lg:h-(--brain-col-h)" style={{ "--brain-col-h": `${COL_H}px` } as React.CSSProperties}>
      <h3 className="m-0 mb-2 flex h-10 items-center gap-2.5 font-display text-[22px] leading-none font-extrabold uppercase">
        <span aria-hidden="true" className={cn("h-7 w-6 shrink-0", HEX, mark)} />
        {title}
        <span className="font-mono text-xs leading-4 font-medium tracking-normal text-muted-foreground normal-case">{note}</span>
      </h3>
      {children}
    </div>
  );
}

const PANEL = "flex flex-col gap-2 border-2 border-qloo bg-background px-4 py-3.5";

function TracePanel({ selected, onClear }: { selected: NodeId | null; onClear: () => void }) {
  return selected ? <TracedPanel selected={selected} onClear={onClear} /> : <IdlePanel />;
}

function IdlePanel() {
  return (
    <div className={PANEL} data-testid="trace-panel">
      <p className="m-0 font-display text-[22px] leading-[1.1] font-extrabold text-qloo uppercase">Pick any piece</p>
      <p className="m-0 font-mono text-[13px] leading-5 text-muted-foreground">Choose a Qloo call, a data point or a part of your busk, and its whole path lights up.</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm leading-5">
        {[
          [nodeLabel("f_setlist"), "four Qloo calls, Spotify and Last.fm meet in your suggested set"],
          [nodeLabel("c3"), "one call that shapes the map and the ranking"],
        ].map(([name, what]) => (
          <li key={name} className="flex gap-2">
            <span aria-hidden="true" className="mt-[3px] h-3.5 w-2 shrink-0 bg-primary [clip-path:polygon(0_0,50%_0,100%_50%,50%_100%,0_100%)]" />
            <span>
              Try <b>{name}</b>: {what}
            </span>
          </li>
        ))}
      </ul>
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
  const reach = (isFeature ? [...calls, ...secondarySources] : features).filter((n) => nodes.has(n.id) && n.id !== selected);
  const links = edges.flatMap((e) => (e.to === selected ? [{ dir: "From", name: nodeLabel(e.from), how: e.how }] : e.from === selected ? [{ dir: "To", name: nodeLabel(e.to), how: e.how }] : []));
  return (
    <div
      ref={ref}
      className={cn(PANEL, "sticky bottom-(--bottom-nav) z-10 max-h-[45vh] overflow-auto text-popover-foreground shadow-[0_-8px_24px_rgb(0_0_0/0.35)]")}
      data-testid="trace-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="m-0 font-display text-[22px] leading-[1.1] font-extrabold text-signal-text uppercase">{nodeLabel(selected)}</p>
        <Button type="button" variant="outline" size="sm" className="border-[1.5px] border-foreground font-mono text-xs font-bold uppercase" onClick={onClear}>
          Clear trace
        </Button>
      </div>
      {/* Keyboard users tabbing through the pieces get a slim bar (name and Clear trace) so the panel covers less of the
          page; the details come back when focus leaves the pieces. Mouse clicks don't match :focus-visible. */}
      <div className="flex flex-col gap-2 text-sm leading-5 group-has-[[data-node-id]:focus-visible]/brain:hidden" data-testid="trace-detail">
        <p className="m-0 font-mono text-[13px] text-muted-foreground">{lightsUp(selected)}</p>
        {reach.length > 0 && (
          <p className="m-0">
            <b className="text-qloo">{isFeature ? "Comes from: " : "Decides: "}</b>
            {reach.map((n) => n.label).join(" · ")}
          </p>
        )}
        {links.length > 0 && (
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-[18px]">
            {links.map((l) => (
              <li key={`${l.dir}-${l.name}`}>
                <b>
                  {l.dir} {l.name}
                </b>
                : {l.how}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
