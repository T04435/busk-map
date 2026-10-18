"use client";

import { useState } from "react";
import { SongActions } from "@/components/honeycomb/song-actions";
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
      <SongActions
        title={title}
        size="sm"
        added={state.kind === "done"}
        onAdd={() => {
          if (state.kind !== "adding") void add();
        }}
      />
      <span role="status" className={state.kind === "error" ? "text-destructive" : "text-muted-foreground"}>
        {state.kind === "done" || state.kind === "error" ? state.text : ""}
      </span>
    </span>
  );
}
