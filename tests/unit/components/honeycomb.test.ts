import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppHeaderView } from "@/components/honeycomb/app-header";
import { HexCell, cellHeight, initialsOf } from "@/components/honeycomb/hex-cell";
import { leanText } from "@/components/honeycomb/lean-bar";
import { MobileNavView } from "@/components/honeycomb/mobile-nav";
import { activeNavId, NAV_ITEMS } from "@/components/honeycomb/nav-items";
import { PercentCell, percentLabel } from "@/components/honeycomb/percent-cell";
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

  it("shows a dashed cell and a dash for no data", () => {
    const out = html(createElement(PercentCell, { value: null, label: "Affinity" }));
    expect(out).toContain('aria-label="Affinity no data"');
    expect(out).toContain('data-tone="dashed"');
    expect(out).toContain("–");
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
  it("has the three destinations, in order", () => {
    expect(NAV_ITEMS.map((i) => [i.label, i.href])).toEqual([
      ["Busks", "/busks"],
      ["Week", "/week"],
      ["Brain", "/brain"],
    ]);
  });

  it("maps paths to the active item (the plan pages are Busks; the landing has none)", () => {
    expect(activeNavId("/")).toBeNull();
    expect(activeNavId(null)).toBeNull();
    expect(activeNavId("/busks")).toBe("busks");
    expect(activeNavId("/plan")).toBe("busks");
    expect(activeNavId("/p/abc123")).toBe("busks");
    expect(activeNavId("/week")).toBe("week");
    expect(activeNavId("/brain/")).toBe("brain");
    expect(activeNavId("/tips")).toBeNull();
    expect(activeNavId("/pitchfork")).toBeNull();
  });

  for (const [name, View] of [
    ["AppHeader", AppHeaderView],
    ["MobileNav", MobileNavView],
  ] as const) {
    it(`${name} marks exactly the current page with aria-current`, () => {
      const out = html(createElement(View, { pathname: "/week" }));
      expect(out.match(/aria-current="page"/g)).toHaveLength(1);
      expect(out).toMatch(/aria-current="page"[^>]*>(?:(?!<\/a>).)*Week/);
      expect(out).toContain('aria-label="Main"');
      for (const href of ["/busks", "/week", "/brain"]) expect(out).toContain(`href="${href}"`);
    });

    it(`${name} marks nothing on the landing page`, () => {
      expect(html(createElement(View, { pathname: "/" }))).not.toContain("aria-current");
    });
  }
});
