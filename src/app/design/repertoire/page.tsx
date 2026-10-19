import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/honeycomb/page-header";
import { RepertoirePreview, type PreviewState } from "@/components/honeycomb/repertoire/repertoire-preview";

export const metadata: Metadata = { title: "Repertoire research · design preview", robots: { index: false, follow: false } };

const STATES: PreviewState[] = ["empty", "running", "done", "hive"];

/** BRAND's design preview of the Repertoire research flow: ?state=empty|running|done|hive&theme=dark. Sample data; not linked. */
export default function RepertoireDesignPreview({ searchParams }: PageProps<"/design/repertoire">) {
  return (
    <Suspense>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/design/repertoire">, "searchParams">) {
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const state = STATES.includes(pick(sp.state) as PreviewState) ? (pick(sp.state) as PreviewState) : "done";
  return (
    <main id="main" data-theme={pick(sp.theme) === "dark" ? "dark" : undefined} className="flex-1 bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8 md:py-12">
        <PageHeader title={state === "hive" ? "The Hive" : "Your Repertoire"} />
        <div className="mt-8">
          <RepertoirePreview state={state} />
        </div>
      </div>
    </main>
  );
}
