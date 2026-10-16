import { QlooWordmark } from "@/components/honeycomb/logo";

export type Partner = {
  name: string;
  /** What it does for Busk Map, in a line. */
  role: string;
  /** The partner's official site. Opens in the same tab. */
  href: string;
  /** The official logo file (a path under /public or a URL) once BRAND supplies it. Until then the slot shows the name as text. */
  logoSrc?: string;
};

/** "Built with" (L21b, F23-F24). Swapping in a logo is a data change: set `logoSrc` on the row. */
export const BUILT_WITH: Partner[] = [
  { name: "Claude", role: "Researches each busk and writes why", href: "https://www.anthropic.com/claude" },
  { name: "Vercel", role: "Hosting and AI SDK", href: "https://vercel.com" },
  { name: "Neon", role: "Postgres for plans, runs and Repertoires", href: "https://neon.com" },
  { name: "Spotify", role: "Songs, artists and release years", href: "https://www.spotify.com" },
  { name: "Last.fm", role: "Song plays and top tracks", href: "https://www.last.fm" },
  { name: "Ticketmaster", role: "Events letting out near each pitch", href: "https://www.ticketmaster.com" },
  { name: "Open-Meteo", role: "The forecast for your hours", href: "https://open-meteo.com" },
  { name: "MapLibre", role: "Draws the map", href: "https://maplibre.org" },
  { name: "OpenStreetMap", role: "Map data © OpenStreetMap contributors", href: "https://www.openstreetmap.org" },
];

/** The logo slot: the logo file when there is one, else a labelled placeholder (the official files are pending). */
function LogoSlot({ partner }: { partner: Partner }) {
  if (partner.logoSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={partner.logoSrc} alt="" aria-hidden="true" className="block h-8 w-auto max-w-full self-start object-contain" />;
  }
  return (
    <span
      aria-hidden="true"
      data-testid="logo-pending"
      className="inline-block self-start border border-dashed border-border px-2 py-1 font-mono text-[11px] leading-4 tracking-[0.06em] text-muted-foreground uppercase"
    >
      {partner.name} logo
    </span>
  );
}

/** Thanks to (L21b): Qloo as the only sponsor, then the stack and data Busk Map is built with. */
export function PartnersSection({ partners = BUILT_WITH }: { partners?: Partner[] }) {
  return (
    <section aria-labelledby="thanks-h" data-testid="partners" className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="thanks-h" className="m-0 font-display text-[clamp(44px,5vw,72px)] leading-[0.92] font-extrabold uppercase">
          Thanks to
        </h2>
        <p className="m-0 max-w-md text-sm leading-5 text-muted-foreground">
          Qloo is the hackathon&apos;s sponsor. Everything else is the stack and the open data Busk Map is built with.
        </p>
      </div>

      <div data-testid="sponsor" className="flex flex-wrap items-center gap-x-10 gap-y-6 border-[3px] border-rule bg-card p-6 shadow-[8px_8px_0_var(--qloo)] md:p-8">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[11px] leading-4 font-bold tracking-[0.08em] text-muted-foreground uppercase">Sponsor</span>
          <QlooWordmark width={176} className="w-[clamp(120px,30vw,176px)]" wordmarkClassName="h-auto w-full text-foreground" />
        </div>
        <p className="m-0 max-w-xl min-w-0 flex-[1_1_280px] text-base leading-6">
          Qloo&apos;s taste AI is the brain of every busk: the crowd at each pitch, the artists it likes, who&apos;s rising. The Qloo Agentic Hackathon runs on Devpost.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="m-0 font-mono text-xs leading-4 font-bold tracking-[0.08em] text-signal-text uppercase">Built with</h3>
        <ul aria-label="Built with" className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(200px,100%),1fr))] gap-3 p-0">
          {partners.map((p) => (
            <li key={p.name} className="flex">
              <a
                href={p.href}
                className="flex w-full flex-col gap-3 border-2 border-rule bg-card p-4 no-underline hover:shadow-[4px_4px_0_var(--foreground)]"
              >
                <LogoSlot partner={p} />
                <b className="font-display text-xl leading-none font-extrabold uppercase">{p.name}</b>
                <span className="text-sm leading-5 text-muted-foreground">{p.role}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
