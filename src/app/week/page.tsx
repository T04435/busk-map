import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { WeekRepertoire } from "@/components/week/week-repertoire";
import { WeekView } from "@/components/week/week-view";
import { DataSources } from "@/components/plan/data-sources";
import { creditsClaude } from "@/lib/sources";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { parseWeekParams, weekSearchParams } from "@/lib/week-url";
import { buildWeekPlan, WeekQlooUnavailableError } from "@/server/agent/week";
import { CITIES } from "@/server/cities";
import { playlistViewForCookie } from "@/server/playlist/read";
import { adapterContextFor } from "@/server/request";
import { serverNow, serverToday } from "@/server/clock";

export const metadata: Metadata = {
  title: "Plan my week · Busk Map",
  description: "The best five busking sessions in the next seven days.",
};

export default function WeekPage({ searchParams }: PageProps<"/week">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <nav className="mb-6 text-sm">
        <Link className="underline" href="/">
          Busk Map home
        </Link>
      </nav>
      <Suspense
        fallback={
          <div className="space-y-4" role="status" aria-busy="true">
            <span className="sr-only">Loading week</span>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <WeekContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function WeekContent({ searchParams }: Pick<PageProps<"/week">, "searchParams">) {
  const params = await searchParams;
  await connection();
  const today = serverToday(CITIES.melbourne.timeZone);
  const parsed = parseWeekParams(params, today);
  if (!parsed.ok) {
    return (
      <>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">Plan my week</h1>
        <Alert variant="destructive">
        <AlertTitle>We couldn&apos;t read this week plan</AlertTitle>
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
  const adapters = adapterContextFor(faults);
  const plan = await buildWeekPlan(parsed.request, adapters, today, false, serverNow()).catch((error: unknown) => {
    if (error instanceof WeekQlooUnavailableError) return null;
    throw error;
  });
  if (!plan) {
    return (
      <>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">Plan my week</h1>
        <Alert variant="destructive">
        <AlertTitle>Qloo is unavailable</AlertTitle>
        <AlertDescription>Busk Map needs Qloo&apos;s taste data to plan. Please try again in a few minutes.</AlertDescription>
      </Alert>
      </>
    );
  }
  // Example weeks never read a Repertoire (§3.5). Otherwise this device's Repertoire, if it has songs, gets a switch.
  const repertoire = parsed.exampleId ? null : await playlistViewForCookie((await headers()).get("cookie"));
  return (
    <div className="space-y-6">
      {repertoire && repertoire.songs.length > 0 && <WeekRepertoire repertoire={repertoire} request={parsed.request} />}
      {/* Keyed by the request: a changed URL means a new plan, not stale client state. */}
      <WeekView
        key={weekSearchParams(parsed.request, parsed.exampleId).toString()}
        initialPlan={plan} request={parsed.request} exampleId={parsed.exampleId} faults={adapters.faults.length ? adapters.faults.join(",") : null} />
      <DataSources status={plan.dataStatus} showAi={creditsClaude(plan)} />
    </div>
  );
}
