import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentStatusLine } from "@/components/honeycomb/agent-status-line";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { LeanBar } from "@/components/honeycomb/lean-bar";
import { PageHeader } from "@/components/honeycomb/page-header";
import { PitchRow } from "@/components/honeycomb/pitch-row";
import { SlotPassed } from "@/components/honeycomb/slot-passed";
import { SetlistPanel } from "@/components/setlist/setlist-panel";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("PitchRow (DS compact row)", () => {
  const row = (extra = {}) => html(createElement(PitchRow, { rank: 1, name: "Southbank", score: 91, badges: "B", onSelect: () => {}, onDetails: () => {}, ...extra }));
  it("shows the name without the busk's time, with no rule between the lines", () => {
    const out = row();
    expect(out).toMatch(/<b[^>]*>Southbank<\/b><\/span>/);
    expect(out).not.toContain("@ ");
    expect(out).not.toContain("border-t");
    expect(out).toContain("Full details");
    expect(out).toContain('data-testid="pitch-details-open"');
  });
  it("shows the any-time window under the name, with its test id", () => {
    const out = row({ window: "Best 6 pm–9 pm" });
    expect(out).toContain('data-testid="pitch-row-window"');
    expect(out).toContain("Best 6 pm–9 pm");
  });
  it("marks the selected row with the orange offset shadow and aria-pressed", () => {
    expect(row({ selected: true })).toContain('aria-pressed="true"');
    expect(row({ selected: true })).toContain("shadow-[4px_4px_0_var(--primary)]");
    expect(row()).not.toContain("shadow-[4px_4px_0_var(--primary)]");
  });
});

describe("LeanBar", () => {
  it("draws a signed bar either side of a centre line with the signed number", () => {
    const pos = html(createElement(LeanBar, { label: "25–34", lean: 0.41 }));
    expect(pos).toContain("+41");
    expect(pos).toContain("left-1/2");
    const neg = html(createElement(LeanBar, { label: "55+", lean: -0.3 }));
    expect(neg).toContain("−30");
    expect(neg).toContain("right-1/2");
  });
});

describe("PageHeader", () => {
  it("renders meta, a display-caps title, badges with icons and bold links", () => {
    const out = html(createElement(PageHeader, { meta: "Meta", title: "Title", back: {}, badges: [{ label: "Legal", tone: "legal", icon: "legal" }], links: [{ label: "Go", href: "/x" }] }));
    expect(out).toContain("Busk Map home");
    expect(out).toContain("<h1");
    expect(out).toContain("<svg");
    expect(out).toContain('href="/x"');
  });
});

describe("DiscoveryBadge", () => {
  it("carries the DS icon for each kind and keeps the app's words", () => {
    expect(html(createElement(DiscoveryBadge, { discovery: "hidden-gem" }))).toContain("Hidden gem");
    expect(html(createElement(DiscoveryBadge, { discovery: "usual" }))).toContain("Usual pitch");
    expect(html(createElement(DiscoveryBadge, { discovery: "usual" }))).toContain("<svg");
    expect(html(createElement(DiscoveryBadge, { discovery: "none" }))).toBe("");
  });
});

describe("SlotPassed and AgentStatusLine", () => {
  it("keeps the test id and the copy", () => {
    const out = html(createElement(SlotPassed, { slotLabel: "Sat 12–3 pm", againHref: "/busks?again=x" }));
    expect(out).toContain('data-testid="slot-passed"');
    expect(out).toContain("This slot has passed");
    expect(out).toContain("Plan again for a new date");
  });
  it("a researching line is a polite status with no nested status role", () => {
    const out = html(createElement(AgentStatusLine, { state: "researching" }));
    expect(out).toContain('aria-live="polite"');
    expect(out).toContain('data-testid="agent-status"');
    expect(out.match(/role="status"/g)).toHaveLength(1);
  });
});

describe("SetlistPanel", () => {
  const song = { songId: "s1", title: "Song", artist: "Artist", own: true, score: 80, reason: "r", durationMs: 200000, year: 1990 };
  const out = html(createElement(SetlistPanel, { pitch: { name: "Southbank", setlist: [song] }, learnThese: [], when: "Sat 12–3 pm" }));
  it("reads 'pitch · day time · best fit first'", () => {
    expect(out).toContain("Southbank · Sat 12–3 pm · best fit first");
  });
  it("sets LEARN THESE in the display face and keeps no aria-label on a plain span", () => {
    expect(out).toMatch(/<h4[^>]*font-display[^>]*>/);
    expect(out).not.toMatch(/<span[^>]*aria-label="Length/);
    expect(out).toContain("Length ");
  });
});
