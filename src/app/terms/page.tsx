import type { Metadata } from "next";
import { PageHeader } from "@/components/honeycomb/page-header";
import { SOURCES, type SourceId } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Terms · Busk Map",
  description: "What Busk Map does and does not promise, and where its data comes from.",
};

const CREDITS: SourceId[] = ["qloo", "melbourne-pedestrian", "melbourne-busking", "osm", "ticketmaster", "lastfm", "open-meteo", "spotify", "openfreemap", "ai"];

export default function TermsPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 md:py-12">
      <PageHeader meta="Terms" title="What Busk Map promises" />
      <section aria-labelledby="legal-h" className="flex flex-col gap-3">
        <h2 id="legal-h" className="m-0 font-display text-[28px] leading-none font-extrabold uppercase">
          Check your permit
        </h2>
        <p className="m-0 text-lg leading-7 font-bold">Busk Map never confirms a pitch is legal: check your permit conditions.</p>
        <p className="m-0 text-base leading-6 text-muted-foreground">
          A pitch is ranked from taste, foot traffic, events and the rules we can read. The council&apos;s published zones and your own permit
          decide whether you may play there on the day. The plan is a suggestion, not permission.
        </p>
      </section>
      <section aria-labelledby="credits-h" className="flex flex-col gap-3">
        <h2 id="credits-h" className="m-0 font-display text-[28px] leading-none font-extrabold uppercase">
          Data credits
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 text-sm md:grid-cols-2">
          {CREDITS.map((id) => {
            const source = SOURCES[id];
            return (
              <li key={id} className="border border-border bg-card px-3 py-2">
                <a className="font-bold underline underline-offset-3 hover:decoration-2" href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.credit}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>{" "}
                <span className="text-muted-foreground">({source.licence})</span>
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-labelledby="licence-h" className="flex flex-col gap-3">
        <h2 id="licence-h" className="m-0 font-display text-[28px] leading-none font-extrabold uppercase">
          The code
        </h2>
        <p className="m-0 text-base leading-6">
          Busk Map is open source under the MIT licence. Built solo by T04435, with Claude, during the Qloo Agentic Hackathon.
        </p>
      </section>
    </main>
  );
}
