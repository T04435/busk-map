import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppHeaderView } from "@/components/honeycomb/app-header";
import { HexCell, cellHeight, initialsOf } from "@/components/honeycomb/hex-cell";
import { leanText } from "@/components/honeycomb/lean-bar";
import { MobileNavView } from "@/components/honeycomb/mobile-nav";
import { activeNavId, NAV_ITEMS } from "@/components/honeycomb/nav-items";
import { Loader } from "@/components/honeycomb/loader";
import { MeterBar, PercentCell, percentLabel } from "@/components/honeycomb/percent-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("PercentCell", () => {
  it("names the value for screen readers, rounded and clamped", () => {
    expect(percentLabel(87, "Score")).toBe("Score 87 out of 100");
    expect(percentLabel(86.6)).toBe("87 out of 100");
    expect(percentLabel(120, "Fit")).toBe("Fit 100 out of 100");
    expect(percentLabel(-4)).toBe("0 out of 100");
    expect(percentLabel(null, "Score")).toBe("Score no data");
  });

  it("is one image named 'Score 87 out of 100', with the rounded number shown and never 'N/100'", () => {
    const out = html(createElement(PercentCell, { value: 86.6, label: "Score" }));
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="Score 87 out of 100"');
    expect(out).toContain(">87<");
    expect(out).not.toContain("/100");
    // The ring inside doesn't repeat the label.
    expect(out.match(/out of 100/g)).toHaveLength(1);
  });

  it("shows a dashed cell and the DS minus icon for no data", () => {
    const out = html(createElement(PercentCell, { value: null, label: "Affinity", size: 36 }));
    expect(out).toContain('aria-label="Affinity no data"');
    expect(out).toContain('data-tone="dashed"');
    expect(out).toContain('<path d="M6 12h12"');
    expect(out).toContain('width="15"'); // max(12, round(36 * 0.42))
    expect(out).not.toContain("–");
    expect(html(createElement(PercentCell, { value: null, size: 24 }))).toContain('width="12"');
  });
});

describe("MeterBar", () => {
  it("shows the value as a percent cell with its label", () => {
    const out = html(createElement(MeterBar, { label: "Jazz", value: 0.42 }));
    expect(out).toContain('aria-label="Jazz 42 out of 100"');
    expect(out).toContain("<span>Jazz</span>");
  });

  it("noData shows the no-data cell whatever the value is", () => {
    const out = html(createElement(MeterBar, { label: "Jazz", value: 0.9, noData: true }));
    expect(out).toContain('aria-label="Jazz no data"');
    expect(out).toContain('<path d="M6 12h12"');
    expect(html(createElement(MeterBar, { label: "Jazz", value: null }))).toContain("no data");
  });
});

describe("Loader", () => {
  it("is the DS ring plus a still hex core, a status named 'Loading' by default", () => {
    const out = html(createElement(Loader, {}));
    expect(out).toContain('<span class="bm-loader" role="status" aria-label="Loading">');
    expect(out).toContain('width="24" height="24" viewBox="0 0 48 48"');
    expect(out).toContain('<g class="bm-ringspin"><path d="M38.554 20.371A15 15 0 1 1 27.629 9.446"');
    expect(out).toContain('stroke-width="6.5"');
    expect(out).toContain('class="bm-loader-core" points="24.00,17.40 29.72,20.70 29.72,27.30 24.00,30.60 18.28,27.30 18.28,20.70"');
  });

  it("keeps size, label and className", () => {
    const out = html(createElement(Loader, { size: 14, label: "Working", className: "bm-loader-think" }));
    expect(out).toContain('class="bm-loader bm-loader-think"');
    expect(out).toContain('aria-label="Working"');
    expect(out).toContain('width="14" height="14"');
  });
});

describe("HexCell", () => {
  it("is a pointy-top hexagon sized 0.866 : 1", () => {
    expect(cellHeight(40)).toBe(46.2);
    const out = html(createElement(HexCell, { size: 44, tone: "primary" }, "AB"));
    expect(out).toContain('points="50,0 100,25 100,75 50,100 0,75 0,25"');
    expect(out).toContain("width:44px");
    expect(out).toContain("height:50.8px");
    expect(out).toContain('data-tone="primary"');
    expect(out).toContain(">AB<");
  });

  it("is decorative unless it has a label", () => {
    expect(html(createElement(HexCell, {}, "x"))).toContain('aria-hidden="true"');
    const named = html(createElement(HexCell, { label: "Rank 1" }, "1"));
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Rank 1"');
  });

  it("takes initials from a name", () => {
    expect(initialsOf("Folk Duo")).toBe("FD");
    expect(initialsOf("paul")).toBe("P");
    expect(initialsOf("Angus & Julia Stone")).toBe("A&");
  });
});

describe("RankTile and LeanBar", () => {
  it("is spoken as 'Rank 2'", () => {
    expect(html(createElement(RankTile, { n: 2 }))).toContain('aria-label="Rank 2"');
  });
  it("writes a signed lean", () => {
    expect(leanText(0.41)).toBe("+41");
    expect(leanText(-0.3)).toBe("−30");
    expect(leanText(0)).toBe("0");
  });
});

describe("navigation", () => {
  it("holds features only: Busks and Repertoire (Week removed, Brain lives in the footer)", () => {
    expect(NAV_ITEMS.map((i) => [i.label, i.href])).toEqual([
      ["Busks", "/busks"],
      ["Repertoire", "/repertoire"],
    ]);
  });

  it("maps paths to the active item (the plan pages are Busks; the landing has none)", () => {
    expect(activeNavId("/")).toBeNull();
    expect(activeNavId(null)).toBeNull();
    expect(activeNavId("/busks")).toBe("busks");
    expect(activeNavId("/plan")).toBe("busks");
    expect(activeNavId("/p/abc123")).toBe("busks");
    expect(activeNavId("/repertoire")).toBe("repertoire");
    expect(activeNavId("/week")).toBeNull();
    expect(activeNavId("/brain/")).toBeNull();
    expect(activeNavId("/tips")).toBeNull();
    expect(activeNavId("/pitchfork")).toBeNull();
  });

  it("AppHeader marks Busks with aria-current on a plan page, and nothing on /brain", () => {
    const out = html(createElement(AppHeaderView, { pathname: "/plan" }));
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-current="page"[^>]*>(?:(?!<\/a>).)*Busks/);
    expect(out).toContain('aria-label="Main"');
    expect(out).toContain('href="/busks"');
    for (const href of ["/week", "/brain"]) expect(out).not.toContain(`href="${href}"`);
    expect(html(createElement(AppHeaderView, { pathname: "/brain" }))).not.toContain("aria-current");
    expect(html(createElement(AppHeaderView, { pathname: "/" }))).not.toContain("aria-current");
  });

  it("MobileNav shows the bar once the main nav has two items (Busks and Repertoire), with the current one marked", () => {
    const out = html(createElement(MobileNavView, { pathname: "/repertoire" }));
    expect(out).toContain('href="/busks"');
    expect(out).toContain('href="/repertoire"');
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-current="page"[^>]*href="\/repertoire"/);
  });
});
