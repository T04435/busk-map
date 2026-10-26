"use client";

import { useState } from "react";
import { PageHeader } from "@/components/honeycomb/page-header";
import type { PlaylistView } from "@/lib/playlist-schema";
import type { WeekRequest, WeekResult } from "@/lib/week-schema";
import { WeekForm } from "./week-form";
import { WeekView } from "./week-view";
import { weekShellFor } from "@/lib/week-shell";

/**
 * /week: the form, then the run on the same page (its own link, /w/<id>, replaces the address as soon as the run starts).
 * "Change your week" goes back to the form.
 */
export function WeekPlanner({ now, repertoire, faults, qlooMode }: { now: string; repertoire: PlaylistView | null; faults: string | null; qlooMode: "live" | "synthetic" }) {
  const [run, setRun] = useState<{ request: WeekRequest; shell: WeekResult; key: number } | null>(null);
  const [formKey, setFormKey] = useState(0);
  if (run) {
    return (
      <WeekView
        key={run.key}
        initial={run.shell}
        live={{ request: run.request, faults }}
        onChangeWeek={() => {
          window.history.replaceState(null, "", "/week");
          setRun(null);
          setFormKey((k) => k + 1);
        }}
      />
    );
  }
  return (
    <>
      <PageHeader meta="Your act, your seven days" title="Plan my week" />
      <WeekForm key={formKey} now={now} repertoire={repertoire} onSubmit={(request) => setRun({ request, shell: weekShellFor(request, { qlooMode }), key: Date.now() })} />
    </>
  );
}
