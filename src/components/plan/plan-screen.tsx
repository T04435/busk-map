import { after } from "next/server";
import { PlanView } from "@/components/plan/plan-view";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlanRequest, PlanStreamEvent } from "@/lib/plan-schema";
import { planSearchParams } from "@/lib/plan-url";
import { describeSlot } from "@/lib/slot";
import { qlooMode } from "@/server/adapters/qloo";
import type { AdapterContext } from "@/server/adapters/core";
import { baselineFor } from "@/server/agent/baseline";
import { buildEnginePlan } from "@/server/agent/preload";
import { CITIES } from "@/server/cities";

/** The page-level placeholder while a plan page resolves. */
export function PlanSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading plan">
      <Skeleton className="h-12 w-72 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

type Props = {
  request: PlanRequest;
  exampleId: string | null;
  adapters: AdapterContext;
  /** Test faults to pass on to the agent's API call (outages and fresh-limit); defaults to the adapters' outages. */
  faults?: readonly string[];
  autoRun: boolean;
  shareId?: string | null;
  replay?: { events: PlanStreamEvent[]; note: string } | null;
  fresh?: boolean;
};

/**
 * The plan for a request, shared by /plan?… and /p/<id>. Agent-first: with the
 * agent on (the default) nothing is computed here, so the page and the agent's
 * stream start at once; with run=0 the engine's plan is built here and the
 * baseline starts after the page is sent. A stored run (replay) needs neither.
 */
export async function PlanScreen({ request, exampleId, adapters, faults = adapters.faults, autoRun, shareId = null, replay = null, fresh = false }: Props) {
  let plan = null;
  if (!autoRun && !replay) {
    after(() => baselineFor(request, adapters).then(() => undefined));
    plan = await buildEnginePlan(request, adapters);
  }
  const city = CITIES[request.city];
  return (
    <PlanView
      // Keyed by the request (not the selected pitch): a new request remounts the view.
      // A changed tip log re-renders in place (PlanView adopts the new plan), so the log form keeps its message.
      key={planSearchParams(request).toString()}
      initialPlan={plan}
      heading={{
        cityName: city.name,
        slotLabel: describeSlot(request.slot),
        permit: request.permit,
        performerName: request.performer.name,
        qlooMode: qlooMode(adapters),
        // The agent runs the mock model offline (B-010).
        model: adapters.offline ? "mock" : "claude",
      }}
      request={request}
      center={city.center}
      autoRun={autoRun && !replay}
      exampleId={exampleId}
      faults={faults.length > 0 ? faults.join(",") : null}
      shareId={shareId}
      replay={replay}
      fresh={fresh}
    />
  );
}
