import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PlanScreen, PlanSkeleton, SlotPassedNote } from "@/components/plan/plan-screen";
import { describeSlot } from "@/lib/slot";
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
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <nav className="mb-6 text-sm">
        <Link className="underline" href="/">
          Busk Map home
        </Link>
      </nav>
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
  const againHref = `/?again=${stored.id}#own`;
  const slotLabel = describeSlot(request.slot);

  if (passed && !snapshot) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {city.name} · {slotLabel} · {request.permit} permit
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{request.performer.name}</h1>
        </header>
        <SlotPassedNote slotLabel={slotLabel} againHref={againHref} />
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
    replay = { events: snapshotEvents(snapshot), note: `Replaying the agent's run from ${at} (cached, no new model call)` };
  }
  return (
    <div className="space-y-6">
      {passed && <SlotPassedNote slotLabel={slotLabel} againHref={againHref} />}
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
