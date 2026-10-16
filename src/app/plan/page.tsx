import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TIP_COOKIE } from "@/lib/tips";
import { PlanScreen, PlanSkeleton } from "@/components/plan/plan-screen";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parsePlanParams } from "@/lib/plan-url";
import { serverLocalNow } from "@/server/clock";
import { CITIES } from "@/server/cities";
import { longUrlTarget } from "@/server/plans";
import { adapterContextFor, clientIp, pageFaultsFor, renderFaultRequested } from "@/server/request";

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

/**
 * The long plan URL (/plan?name=…&artists=…, /plan?example=…): resolved to the
 * plan's short id and redirected to /p/<id>. If no id can be made (rate limit,
 * no durable store, a store error) the plan renders here as before. Runs with
 * simulated outages (tests) stay here.
 */
async function PlanContent({ searchParams }: Pick<PageProps<"/plan">, "searchParams">) {
  const params = await searchParams;
  // Plans depend on today's date and live data: always render at request time.
  await connection();
  // The tip log's summary (this browser's cookie), for the personal bonus. Never in the URL.
  const tipCookie = (await cookies()).get(TIP_COOKIE)?.value ?? null;
  const parsed = parsePlanParams(params, serverLocalNow(CITIES.melbourne.timeZone), tipCookie);
  if (!parsed.ok) {
    return (
      <>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">Plan</h1>
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
      </>
    );
  }
  const faults = typeof params.faults === "string" ? params.faults : null;
  if (renderFaultRequested(faults)) throw new Error("Simulated render fault (test)");
  const adapters = adapterContextFor(faults);
  // Any test fault (outages or fresh-limit) keeps the long URL, as before.
  const testFaults = pageFaultsFor(faults);
  const target = await longUrlTarget(parsed, params, testFaults, clientIp(await headers()));
  if (target) redirect(target);
  return <PlanScreen request={parsed.request} exampleId={parsed.exampleId} adapters={adapters} faults={testFaults} autoRun={parsed.autoRun} />;
}
