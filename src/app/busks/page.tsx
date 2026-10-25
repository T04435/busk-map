import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { ExampleActCard } from "@/components/honeycomb/example-act-card";
import { Banner } from "@/components/honeycomb/banner";
import { PageHeader } from "@/components/honeycomb/page-header";
import { PerformerForm, type FormPrefill } from "@/components/landing/performer-form";
import { Warmup } from "@/components/landing/warmup";
import { EXAMPLES } from "@/lib/examples";
import { PERMITS } from "@/lib/plan-schema";
import { isAnyTime, weekdayOf } from "@/lib/slot";
import type { DefaultDateRule } from "@/lib/city-clock";
import { loadStoredPlan } from "@/server/plans";
import { playlistViewForCookie } from "@/server/playlist/read";
import { serverNow } from "@/server/clock";
import { optionOf } from "@/lib/city";
import { fansCityOption } from "@/server/fans-city";
import { adapterContextFor } from "@/server/request";

export const metadata: Metadata = {
  title: "Plan your busk · Busk Map",
  description: "Tell Busk Map who you sound like and what you can play, then pick your hours. It finds the pitches whose crowd matches your music.",
};

export default function BusksPage({ searchParams }: PageProps<"/busks">) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 md:py-12">
      <Warmup />
      <PageHeader
        meta="Your act, your hours"
        title="Plan your busk"
      />
      <Suspense>
        <OwnAct searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/**
 * The form's key: a Repertoire saved since the form was drawn (research adding sound-alikes, say) starts it afresh. Cache
 * Components keeps this page mounted while hidden (React Activity), and new props alone never reset the form's state.
 */
const formKey = (base: string, repertoire: { revision: number } | null) => `${base}:${repertoire?.revision ?? 0}`;

/**
 * `?again=<plan id>` (from a plan whose slot has passed): the form pre-filled with that act, on the next same weekday (an
 * any-time plan opens on Any time, on the next date a window can still start). Without it, the form defaults to Any time
 * and pre-fills from this device's Repertoire (its cookie), if any.
 */
async function OwnAct({ searchParams }: Pick<PageProps<"/busks">, "searchParams">) {
  const query = await searchParams;
  const again = query.again;
  /** `?permit=general` with `again`: plan the same act on another permit (the no-legal-pitch way out). */
  const permitParam = PERMITS.find((p) => p === query.permit);
  // The default date depends on today, so render it at request time.
  await connection();
  const now = serverNow().toISOString();
  const stored = typeof again === "string" ? await loadStoredPlan(again).catch(() => null) : null;
  const repertoire = await playlistViewForCookie((await headers()).get("cookie"));
  if (!stored) {
    // `?fans=<name>~<lat>~<lng>` (the Repertoire's "Plan a busk here"): the form starts on that city.
    const fans = await fansCityOption(typeof query.fans === "string" ? query.fans : undefined, adapterContextFor(typeof query.faults === "string" ? query.faults : null));
    return (
      <>
        <section aria-labelledby="examples-h" className="flex flex-col gap-3.5">
          <h2 id="examples-h" className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
            Or try a made-up act
          </h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3 p-0">
            {EXAMPLES.map((example) => (
              <li key={example.id}>
                <ExampleActCard name={example.label} blurb={example.blurb} soundsLike={example.performer.artists.slice(0, 3)} href={`/plan?example=${example.id}`} />
              </li>
            ))}
          </ul>
        </section>
        <PerformerForm key={formKey(`act:${fans?.id ?? ""}`, repertoire)} startCity={fans ?? undefined} now={now} dateRule={{ kind: "any" }} repertoire={repertoire} />
      </>
    );
  }
  const { performer, slot } = stored.request;
  const permit = permitParam ?? stored.request.permit;
  // Planning again keeps the busk's city.
  const city = optionOf(stored.request);
  // A plan made for "any time" opens the form on any time, on the next date a window can still start.
  const when: { dateRule: DefaultDateRule; prefill: FormPrefill } = isAnyTime(slot)
    ? { dateRule: { kind: "any" }, prefill: { performer, permit, city, anyTime: true } }
    : { dateRule: { kind: "weekday", weekday: weekdayOf(slot.date), startHour: slot.startHour, endHour: slot.endHour }, prefill: { performer, permit, city, startHour: slot.startHour, endHour: slot.endHour } };
  return (
    <>
      <Banner tone="info">
        Planning again for {performer.name}. Your act, artists, songs and permit come from your earlier busk: pick a new date and time.
      </Banner>
      <PerformerForm
        key={formKey(stored.id, repertoire)}
        now={now}
        dateRule={when.dateRule}
        prefill={when.prefill}
        repertoire={repertoire}
      />
    </>
  );
}
