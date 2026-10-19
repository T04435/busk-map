import { ResearchFunnel } from "@/components/honeycomb/research-funnel";
import { LandingBusk } from "@/components/landing/landing-busk";
import { SetlistPanel } from "@/components/setlist/setlist-panel";

/*
 * Everything below is made-up EXAMPLE data, shown through the real components, to show the shape of a busk. It is not a
 * city's data and the section says so. The numbers are the deck's example busk.
 */
const TOTALS = { taste: 412, crowds: 1, places: 4, events: 1, activity: 2, rules: 37, scored: 36, songs: 3 };
const SETLIST = [
  { songId: "ex1", title: "Fast Car", artist: "Tracy Chapman", year: 1988, durationMs: 296_000, score: 92, own: false, reason: "Opens the set: the best known of the top three, and a good era fit for a crowd leaning 25–34." },
  { songId: "ex2", title: "Laneway Light", artist: "The Larkspur Two", year: null, durationMs: null, score: 88, own: true, reason: "Your song." },
  { songId: "ex3", title: "Big Jet Plane", artist: "Angus & Julia Stone", year: 2010, durationMs: 238_000, score: 86, own: false, reason: "This crowd’s favourite artist on Qloo." },
  { songId: "ex4", title: "Harbour Lights", artist: "The Paper Kites", year: 2021, durationMs: 251_000, score: 79, own: false, reason: "Folk fans here know it well (Qloo)." },
];
const LEARN = [
  { artist: "Middle Kids", title: "Edge of Town", reason: "Audience up 38% here this quarter (Qloo)" },
  { artist: "Ruby Fields", title: "Dinosaurs", reason: "Strong with the afternoon crowd (Qloo)" },
];

/**
 * "What you get back", as the deck draws it: the research funnel (what was looked at, in data points), your busk (three pitches
 * and a taste map with their pins), then what to play there with the set length and "Learn these". All of it example data,
 * labelled.
 */
export function WhatYouGet() {
  return (
    <section aria-labelledby="get-h" data-testid="what-you-get" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="get-h" className="m-0 font-display text-[clamp(44px,5vw,72px)] leading-[0.92] font-extrabold uppercase">
          What you get back
        </h2>
      </div>

      <ResearchFunnel layout="landing" totals={TOTALS} live={false} picks={3} />

      <LandingBusk />

      <div className="mt-6 flex flex-wrap items-start gap-x-12 gap-y-6">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <h3 className="m-0 font-display text-[clamp(36px,4vw,56px)] leading-[0.92] font-extrabold uppercase">
            And what
            <br />
            <span className="text-signal-text">to play there</span>
          </h3>
          <p className="m-0 text-lg leading-7">
            Each pitch gets its own order. Qloo says which artists that crowd likes and the age they lean, so your songs are ranked by how well they&apos;ll land
            there. Your own songs stay in, and Qloo&apos;s rising artists show what&apos;s worth learning next.
          </p>
        </div>
        <div className="min-w-0 flex-[999_1_520px]">
          <SetlistPanel variant="preview" pitch={{ name: "Southbank Promenade", setlist: SETLIST }} learnThese={LEARN} ageLean="25–34" />
        </div>
      </div>
    </section>
  );
}
