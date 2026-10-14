import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PlanView } from "@/components/plan/plan-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { parsePlanParams, planSearchParams } from "@/lib/plan-url";
import { localToday } from "@/lib/slot";
import { buildEnginePlan } from "@/server/agent/preload";
import { CITIES } from "@/server/cities";
import { adapterContextFor } from "@/server/request";

export const metadata: Metadata = {
  title: "Plan · Busk Map",
  description: "Where to play, and what to play there.",
};

export default function PlanPage({ searchParams }: PageProps<"/plan">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <nav className="mb-6 text-sm">
        <Link className="underline" href="/">
          Busk Map home
        </Link>
      </nav>
      <Suspense fallback={<PlanSkeleton />}>
        <PlanContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function PlanSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading plan">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

async function PlanContent({ searchParams }: Pick<PageProps<"/plan">, "searchParams">) {
  const params = await searchParams;
  // Plans depend on today's date and live data: always render at request time.
  await connection();
  const parsed = parsePlanParams(params, localToday(CITIES.melbourne.timeZone));
  if (!parsed.ok) {
    return (
      <Alert variant="destructive">
        <AlertTitle>We couldn&apos;t read this plan</AlertTitle>
        <AlertDescription>
          {parsed.error}{" "}
          <Link className="underline" href="/">
            Start again
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }
  const faults = typeof params.faults === "string" ? params.faults : null;
  const adapters = adapterContextFor(faults);
  const plan = await buildEnginePlan(parsed.request, adapters);
  return (
    <PlanView
      // Keyed by the request (not the selected pitch): a new request remounts the view.
      key={planSearchParams(parsed.request).toString()}
      initialPlan={plan}
      request={parsed.request}
      center={CITIES[parsed.request.city].center}
      autoRun={parsed.autoRun}
      faults={adapters.faults.length > 0 ? adapters.faults.join(",") : null}
    />
  );
}
