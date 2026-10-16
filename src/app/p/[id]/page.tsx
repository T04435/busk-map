import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/honeycomb/page-header";
import { SlotPassed } from "@/components/honeycomb/slot-passed";
import { PlanScreen, PlanSkeleton } from "@/components/plan/plan-screen";
import { shortDay, shortHours, slotEyebrow } from "@/lib/slot";
import { TIP_COOKIE } from "@/lib/tips";
import { CITIES } from "@/server/cities";
import { freshRunsAllowed, loadStoredPlan, slotPassed, snapshotEvents, snapshotFor, viewerRequest } from "@/server/plans";
import { adapterContextFor, pageFaultsFor } from "@/server/request";
import { serverToday } from "@/server/clock";

export const metadata: Metadata = {
  title: "Plan · Busk Map",
  description: "Where to play, and what to play there.",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function ShortPlanPage({ params, searchParams }: PageProps<"/p/[id]">) {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
      <Suspense fallback={<PlanSkeleton />}>
        <ShortPlan params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/**
 * A plan behind its short id. A finished run stored on it shows at once, as a
 * replay with its steps; otherwise the agent runs as on /plan. A slot that has
 * passed gets a note and a pre-filled form link, never a silent re-run.
 * Query: pitch=<id>, run=0 (engine only), fresh=1 (developer path: a new run,
 * outside production builds only).
 */
async function ShortPlan({ params, searchParams }: Pick<PageProps<"/p/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await connection();
  const stored = await loadStoredPlan(id);
  if (!stored) notFound();
  const tipCookie = (await cookies()).get(TIP_COOKIE)?.value ?? null;
  const request = viewerRequest(stored, tipCookie);
  if (!request) notFound();

  const adapters = adapterContextFor(first(query.faults));
  const testFaults = pageFaultsFor(first(query.faults));
  const city = CITIES[request.city];
  const fresh = first(query.fresh) === "1" && freshRunsAllowed();
  // run=0 asks for the engine's plan alone (also the fallback when the agent ends without one): no stored run then.
  const engineOnly = first(query.run) === "0";
  const snapshot = fresh || engineOnly || testFaults.length > 0 ? null : snapshotFor(stored, request, adapters.offline);
  const passed = slotPassed(request.slot, city.timeZone);
  const againHref = `/busks?again=${stored.id}`;
  const slotLabel = `${shortDay(request.slot.date)} · ${shortHours(request.slot.startHour, request.slot.endHour)}`;

  if (passed && !snapshot) {
    return (
      <div className="space-y-6">
        <PageHeader meta={`Shared busk · ${slotEyebrow(request.slot, request.permit)}`} title={request.performer.name} />
        <SlotPassed slotLabel={slotLabel} againHref={againHref} alone />
      </div>
    );
  }

  let replay = null;
  if (snapshot) {
    const sameDay = snapshot.runDay === serverToday(city.timeZone);
    const at = new Intl.DateTimeFormat("en-AU", {
      ...(sameDay ? {} : { day: "numeric", month: "short" }),
      hour: "numeric",
      minute: "2-digit",
      timeZone: city.timeZone,
    }).format(snapshot.startedAt);
    replay = { events: snapshotEvents(snapshot), note: `Researched at ${at}${sameDay ? " today" : ""}. Opening it again shows that research: nothing new was asked.` };
  }
  return (
    <div className="space-y-6">
      {passed && <SlotPassed slotLabel={slotLabel} againHref={againHref} />}
      <PlanScreen
        request={request}
        exampleId={stored.exampleId}
        adapters={adapters}
        faults={testFaults}
        autoRun={!engineOnly}
        shareId={stored.id}
        replay={replay}
        fresh={fresh}
      />
    </div>
  );
}
