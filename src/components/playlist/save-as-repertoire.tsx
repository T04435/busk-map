"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";
import type { PlanRequest } from "@/lib/plan-schema";
import { createPlaylist, loadPlaylist } from "./playlist-api";

type State = { kind: "checking" } | { kind: "offer" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; text: string } | { kind: "hidden" };

/**
 * After a busk is planned on a device with no Repertoire: "Save these songs as your Repertoire".
 * An explicit action, never automatic (docs/playlist-architecture.md §3.1). Not shown on example runs, nor
 * when the busk has no songs, nor when this device already has a Repertoire.
 */
export function SaveAsRepertoire({ performer }: { performer: PlanRequest["performer"] }) {
  const [state, setState] = useState<State>(performer.songs.length ? { kind: "checking" } : { kind: "hidden" });

  useEffect(() => {
    if (!performer.songs.length) return;
    let live = true;
    loadPlaylist().then((result) => {
      if (live) setState(result.ok && result.playlist === null ? { kind: "offer" } : { kind: "hidden" });
    });
    return () => {
      live = false;
    };
  }, [performer.songs.length]);

  async function save() {
    setState({ kind: "saving" });
    const ids = new Map(performer.spotifyArtists.map((a) => [a.name, a.id]));
    const result = await createPlaylist({
      actName: performer.name === "My act" ? null : performer.name,
      soundsLike: performer.artists.slice(0, 10).map((name) => ({ name, ...(ids.get(name) ? { spotifyId: ids.get(name) } : {}) })),
      songs: performer.songs.map((s) => ({ title: s.title, artist: s.artist, own: s.own, ...(s.durationMs ? { durationMs: s.durationMs } : {}) })),
    });
    setState(result.ok ? { kind: "saved" } : { kind: "error", text: result.message });
  }

  if (state.kind === "checking" || state.kind === "hidden") return null;
  return (
    <Card data-testid="save-as-repertoire">
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {state.kind === "saved" ? (
          <p role="status">
            {COPY.saved}{" "}
            <Link className="underline" href="/repertoire">
              Open your {COPY.name}
            </Link>
          </p>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => void save()} disabled={state.kind === "saving"}>
              {state.kind === "saving" ? COPY.saving : COPY.saveThese}
            </Button>
            {state.kind === "error" && (
              <p role="alert" className="w-full text-destructive">
                {state.text}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
