"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";
import { addPlanSuggestion } from "./playlist-api";

type State = { kind: "idle" } | { kind: "adding" } | { kind: "done"; text: string } | { kind: "error"; text: string };

/**
 * "Add to Repertoire" on a plan's Songs to learn (docs/playlist-architecture.md §3.3): the song joins the Songs to learn
 * list ("Added from plans"). It never edits the plan, and a song already suggested or already sung is said so, politely.
 * Not shown on example runs (§3.5).
 */
export function AddToRepertoire({ title, artist, reason, growth }: { title: string; artist: string; reason: string; growth: number | null }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function add() {
    setState({ kind: "adding" });
    const result = await addPlanSuggestion({ title, artist, reason, growth });
    if (result.ok) setState({ kind: "done", text: COPY.addedToLearn });
    else if (result.code === "already_suggested" || result.code === "in_repertoire") setState({ kind: "done", text: result.message });
    else setState({ kind: "error", text: result.message });
  }

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <Button
        type="button"
        variant="outline"
        size="xs"
        aria-label={`${COPY.addTo}: ${title}`}
        disabled={state.kind === "adding" || state.kind === "done"}
        onClick={() => void add()}
      >
        {state.kind === "adding" ? COPY.adding : COPY.addTo}
      </Button>
      <span role="status" className={state.kind === "error" ? "text-destructive" : "text-muted-foreground"}>
        {state.kind === "done" || state.kind === "error" ? state.text : ""}
      </span>
    </span>
  );
}
