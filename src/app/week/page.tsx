import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { Warmup } from "@/components/landing/warmup";
import { WeekPlanner } from "@/components/week/week-planner";
import { Skeleton } from "@/components/ui/skeleton";
import { serverNow } from "@/server/clock";
import { testSwitches } from "@/server/env";
import { playlistViewForCookie } from "@/server/playlist/read";

export const metadata: Metadata = {
  title: "Plan my week · Busk Map",
  description: "The best pitch for each of the next seven days, in any city: one run of the Hive, a busk plan for every day worth playing.",
};

export default function WeekPage({ searchParams }: PageProps<"/week">) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 md:py-12">
      <Warmup />
      <Suspense fallback={<WeekSkeleton />}>
        <WeekContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function WeekSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

/** The form starts from this device's Repertoire (its cookie), like the busk form; the clock is the server's. */
async function WeekContent({ searchParams }: Pick<PageProps<"/week">, "searchParams">) {
  const query = await searchParams;
  await connection();
  const repertoire = await playlistViewForCookie((await headers()).get("cookie"));
  const faults = typeof query.faults === "string" ? query.faults : null;
  return <WeekPlanner key={repertoire?.revision ?? 0} now={serverNow().toISOString()} repertoire={repertoire} faults={faults} qlooMode={testSwitches().offline ? "synthetic" : "live"} />;
}
