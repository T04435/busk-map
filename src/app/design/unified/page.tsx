import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/honeycomb/page-header";
import { UnifiedSpecimen } from "./specimen";

export const metadata: Metadata = { title: "One song, one artist · design preview", robots: { index: false, follow: false } };

/** BRAND's specimen of the unified song and artist components: every case from the unify spec, built only from them. ?theme=dark. Not linked. */
export default function UnifiedDesignPreview({ searchParams }: PageProps<"/design/unified">) {
  return (
    <Suspense>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/design/unified">, "searchParams">) {
  const sp = await searchParams;
  return (
    <main id="main" data-theme={sp.theme === "dark" ? "dark" : undefined} className="flex-1 bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8 md:py-12">
        <PageHeader title="One song, one artist" />
        <div className="mt-8">
          <UnifiedSpecimen />
        </div>
      </div>
    </main>
  );
}
