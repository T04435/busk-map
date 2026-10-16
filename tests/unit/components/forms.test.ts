import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PermitPicker } from "@/components/forms/permit-picker";
import { QUICK_SLOTS, TimeSlotPicker } from "@/components/forms/time-slot-picker";
import { DatePicker } from "@/components/forms/date-picker";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("TimeSlotPicker (DS)", () => {
  it("lists the four slots with the DS ranges and no From or To", () => {
    const out = html(createElement(TimeSlotPicker, { value: "evening", onChange: () => {} }));
    expect(out).toContain(">Time<");
    for (const [label, range] of [["Morning", "9 am–12 pm"], ["Lunch", "12–3 pm"], ["Afternoon", "3–6 pm"], ["Evening", "6–9 pm"]]) {
      expect(out).toContain(label);
      expect(out).toContain(range);
    }
    expect(QUICK_SLOTS).toHaveLength(4);
    expect(out).not.toContain("Any time");
    expect(out).not.toContain(">From<");
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("anyTime adds the dashed Any time first, the optional label and the hint when it is pressed", () => {
    const out = html(createElement(TimeSlotPicker, { value: "any", anyTime: true, onChange: () => {} }));
    expect(out).toContain("Time (optional)");
    expect(out.indexOf("Any time")).toBeLessThan(out.indexOf("Morning"));
    expect(out).toContain("Busk Map picks");
    expect(out).toContain("border-dashed");
    expect(out).toContain("Busk Map finds the best hours that day");
  });
});

describe("DatePicker (DS)", () => {
  it("is a labelled field button with the calendar icon", () => {
    const out = html(createElement(DatePicker, { id: "date", label: "Date", value: "", onChange: () => {} }));
    expect(out).toContain('aria-haspopup="dialog"');
    expect(out).toContain("Pick a date");
    expect(out).toContain("<svg");
  });
});

describe("PermitPicker (DS choice cards)", () => {
  it("draws the picked card with the orange offset rule and keeps the hint", () => {
    const out = html(createElement(PermitPicker, { value: "general", onValueChange: () => {} }));
    expect(out).toContain("General permit");
    expect(out).toContain("has-[[data-state=checked]]:shadow-[4px_4px_0_var(--primary)]");
    expect(out).toContain("This changes which pitches are shown.");
  });
});
