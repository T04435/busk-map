import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekView } from "@/components/week/week-view";
import { testSwitches } from "@/server/env";
import { loadWeek } from "@/server/week";

export const metadata: Metadata = {
  title: "Your week · Busk Map",
  description: "The best pitch for each day of the week, each with its own busk plan.",
};

export default function StoredWeekPage({ params }: PageProps<"/w/[id]">) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 md:py-12">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" role="status" aria-busy="true">
            <span className="sr-only">Loading your week</span>
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <StoredWeek params={params} />
      </Suspense>
    </main>
  );
}

/** A planned week (/w/<id>): the record replayed (no new model or Qloo call), or followed while its run is still going. */
async function StoredWeek({ params }: Pick<PageProps<"/w/[id]">, "params">) {
  const { id } = await params;
  await connection();
  const loaded = await loadWeek(id, testSwitches().offline);
  if (!loaded) notFound();
  return <WeekView initial={loaded.week} events={loaded.events} plans={Object.fromEntries(loaded.plans)} />;
}
