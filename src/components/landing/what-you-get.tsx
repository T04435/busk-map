import { Badge } from "@/components/ui/badge";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";

/** Made-up pitches and songs, to show the shape of a busk. They are not a city's data and the section says so. */
const PITCHES = [
  { rank: 1, name: "Southbank Promenade", when: "12–3 pm", score: 91, discovery: "hidden-gem" as const, why: "Folk fans gather here; a matinee lets out at 2:45 pm" },
  { rank: 2, name: "Hardware Lane", when: "12–3 pm", score: 84, discovery: "hidden-gem" as const, why: "Folk crowd, lunch queues from 12" },
  { rank: 3, name: "Degraves Street", when: "12–3 pm", score: 78, discovery: "usual" as const, why: "Café crowd all afternoon, shared with other buskers" },
];
const SETLIST = [
  { title: "Fast Car", artist: "Tracy Chapman", fit: 92 },
  { title: "Laneway Light", artist: "The Larkspur Two", fit: 88, own: true },
  { title: "Big Jet Plane", artist: "Angus & Julia Stone", fit: 86 },
];

/** "What you get back": your three pitches with their scores and reasons, then what to play at each. An example, labelled. */
export function WhatYouGet() {
  return (
    <section aria-labelledby="get-h" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="get-h" className="m-0 font-display text-[clamp(44px,5vw,72px)] leading-[0.92] font-extrabold uppercase">
          What you get back
        </h2>
        <Badge variant="estimate">Example data</Badge>
      </div>
      <p className="m-0 max-w-3xl text-lg leading-[27px]">
        Your busk is three pitches, each with a score, the reasons behind it and a setlist in order. One link, kept so you can open it again.
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 border-2 border-rule bg-card p-4 md:p-6">
          <h3 className="m-0 font-display text-heading">Your busk · Sunday, 12–3 pm</h3>
          <ol className="m-0 flex list-none flex-col divide-y divide-border p-0">
            {PITCHES.map((pitch) => (
              <li key={pitch.rank} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <RankTile n={pitch.rank} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <b className="font-display text-[22px] leading-[1.05] font-extrabold uppercase">{pitch.name}</b>
                    <DiscoveryBadge discovery={pitch.discovery} />
                  </div>
                  <span className="block text-sm leading-5 text-muted-foreground">{pitch.why}</span>
                  <span className="block font-mono text-xs leading-4 text-muted-foreground">{pitch.when}</span>
                </div>
                <PercentCell value={pitch.score} size={52} label="Score" tone={pitch.rank === 1 ? "primary" : undefined} />
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-3 border-2 border-rule bg-card p-4 md:p-6">
          <h3 className="m-0 font-display text-heading">And what to play there</h3>
          <p className="m-0 text-sm leading-5 text-muted-foreground">Each pitch gets its own order, ranked by how well each song will land with that crowd. Your own songs stay in.</p>
          <ol className="m-0 flex list-none flex-col divide-y divide-border border-t border-border p-0">
            {SETLIST.map((song, i) => (
              <li key={song.title} className="flex items-center gap-3 py-2.5">
                <HexCell size={30} tone="muted" fontSize={13}>
                  {i + 1}
                </HexCell>
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{song.title}</b>
                  <span className="block truncate text-sm leading-5 text-muted-foreground">{song.artist}</span>
                </span>
                {song.own ? <Badge variant="solid">Your song</Badge> : null}
                <PercentCell value={song.fit} size={40} label="Fit" />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
