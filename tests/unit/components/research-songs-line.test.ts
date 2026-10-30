import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TOOL_UI } from "@/components/plan/tool-results";
import type { AgentStep } from "@/lib/agent-steps";

/** Research step 2's line: a rerun that finds every song already saved never reads "Added 0 … including". */
const step = { tool: "research_songs", label: "research_songs" } as unknown as AgentStep;
const text = (out: Record<string, unknown>) => renderToStaticMarkup(createElement(Fragment, null, TOOL_UI.research_songs.render(out, step, {}))).replace(/<[^>]+>/g, "");
const songs = [{ title: "Moonlight", artist: "Pigram Brothers" }, { title: "Wind Dance", artist: "Pigram Brothers" }];

describe("the songs step line", () => {
  it("says how many were added", () => {
    expect(text({ source: "spotify", added: 2, already: 0, songs })).toMatch(/^Added 2 of your songs from .*Spotify, including /);
  });

  it("says the songs were already there when none were added", () => {
    const line = text({ source: "spotify", added: 0, already: 40, songs });
    expect(line).toMatch(/^Your 40 songs from .*Spotify were already in your Repertoire, including /);
    expect(line).not.toContain("Added 0");
  });
});
