import { cn } from "cn";
import { InView } from "@/components/honeycomb/in-view";
import { QlooWordmark } from "@/components/honeycomb/logo";

/** A logo file, or a light and a dark one swapped by the theme (the app's own theme mechanism: the dark variant). */
type Logo = string | { light: string; dark: string };

export type Partner = {
  name: string;
  /** What it does for Busk Map, in a line. */
  role: string;
  /** The partner's official site. Opens in the same tab. */
  href: string;
  /** The official logo from /partners (BRAND's sanitised files, never recoloured). */
  logo?: Logo;
  /** Logo height in px (the DS's per-brand optical size). */
  h?: number;
  /** A white-only logo (Ticketmaster) sits on the brand's own ground by day; at night it sits on the tile. */
  plate?: string;
  /** A plain-text name beside the icon (Open-Meteo), or alone where there is no logo to use (OpenStreetMap: its trademark policy covers the name, not the logo). */
  mark?: string;
};

/** "Built with" (L21b, F23-F24), as BRAND's PartnersSection v66 lists it. */
export const BUILT_WITH: Partner[] = [
  { name: "Claude", role: "Powers Hive: researches each busk and writes why", href: "https://www.anthropic.com/claude", logo: { light: "/partners/claude-logo-slate.svg", dark: "/partners/claude-logo-ivory.svg" }, h: 27 },
  { name: "Vercel", role: "Hosting and AI SDK", href: "https://vercel.com", logo: { light: "/partners/vercel-logotype-black.svg", dark: "/partners/vercel-logotype-white.svg" }, h: 24 },
  { name: "Neon", role: "Postgres for plans, runs and Repertoires", href: "https://neon.com", logo: { light: "/partners/neon-logo-light-color.svg", dark: "/partners/neon-logo-dark-color.svg" }, h: 28 },
  { name: "Spotify", role: "Songs, artists and release years", href: "https://www.spotify.com", logo: { light: "/partners/spotify-full-logo-black.svg", dark: "/partners/spotify-full-logo-white.svg" }, h: 32 },
  { name: "Last.fm", role: "Song plays and top tracks", href: "https://www.last.fm", logo: "/partners/lastfm-logo.svg", h: 25 },
  { name: "Ticketmaster", role: "Events letting out near each pitch", href: "https://www.ticketmaster.com", logo: "/partners/ticketmaster-logo-white.svg", plate: "#024DDF" },
  { name: "Open-Meteo", role: "The forecast for your hours", href: "https://open-meteo.com", logo: { light: "/partners/open-meteo-icon-light.svg", dark: "/partners/open-meteo-icon-dark.svg" }, mark: "Open-Meteo" },
  { name: "MapLibre", role: "Draws the map", href: "https://maplibre.org", logo: { light: "/partners/maplibre-logo-for-light-bg.svg", dark: "/partners/maplibre-logo-for-dark-bg.svg" }, h: 28 },
  { name: "OpenStreetMap", role: "Map data © OpenStreetMap contributors", href: "https://www.openstreetmap.org", mark: "OpenStreetMap" },
];

/* eslint-disable @next/next/no-img-element -- fixed SVG files from /public/partners */
function Img({ src, className, h }: { src: string; className?: string; h?: number }) {
  return <img src={src} alt="" height={h ?? 32} style={h ? { height: h } : undefined} className={cn("block h-8 w-auto max-w-full", className)} />;
}

/** The logo slot, ported from the DS's PartnerLogo: light and dark files swapped by theme, a plate for a white-only logo, a text mark beside an icon or alone. The link carries the name; the images are decorative. */
function LogoSlot({ partner: p }: { partner: Partner }) {
  const lg = p.logo;
  const imgs = !lg ? null : typeof lg === "string" ? (
    <Img src={lg} h={p.h} className={p.plate ? "h-[18px] dark:h-[22px]" : undefined} />
  ) : (
    <>
      <Img src={lg.light} h={p.h} className="dark:hidden" />
      <Img src={lg.dark} h={p.h} className="hidden dark:block" />
    </>
  );
  if (!imgs && !p.mark) {
    return (
      <span aria-hidden="true" data-testid="logo-pending" className="inline-flex h-8 items-center border-[1.5px] border-dashed border-border px-2.5 font-mono text-[11px] leading-none font-medium tracking-[0.04em] text-muted-foreground uppercase">
        {p.name} logo
      </span>
    );
  }
  const body = (
    <span className="inline-flex min-w-0 items-center gap-2">
      {imgs}
      {p.mark ? <span className={cn("font-sans text-[20px] leading-none font-bold tracking-[-0.01em] whitespace-nowrap text-foreground", !imgs && "text-[22px]")}>{p.mark}</span> : null}
    </span>
  );
  return p.plate ? (
    <span className="inline-flex h-10 items-center bg-(--plate) px-3 dark:bg-transparent dark:px-0" style={{ "--plate": p.plate } as React.CSSProperties}>
      {body}
    </span>
  ) : (
    body
  );
}

/** Thanks to (L21b): Qloo as the only sponsor, then the stack and data Busk Map is built with. */
export function PartnersSection({ partners = BUILT_WITH }: { partners?: Partner[] }) {
  return (
    <section aria-labelledby="thanks-h" data-testid="partners" className="flex flex-col gap-10">
      <h2 id="thanks-h" className="m-0 text-center font-display text-[clamp(44px,5vw,72px)] leading-[0.92] font-extrabold uppercase">
        Thanks to
      </h2>
      {/* The sponsor, first and largest (user, live session 17 Oct): a centred "Sponsored by" card with the Qloo wordmark. */}
      <div data-testid="sponsor" className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 border-[3px] border-rule bg-card px-6 py-10 text-center shadow-[8px_8px_0_var(--qloo)] md:px-12 md:py-12">
        <span className="font-mono text-xs leading-4 font-bold tracking-[0.12em] text-qloo uppercase">Sponsored by</span>
        {/* The wordmark assembles when it scrolls into view: letters rise in turn, then the purple bar stretches in (hc-qloo-rise in globals.css; still under reduced motion). */}
        <InView>
          <QlooWordmark width={300} className="w-[clamp(180px,40vw,300px)]" wordmarkClassName="hc-qloo-rise h-auto w-full text-foreground" />
        </InView>
        <p className="m-0 max-w-md text-base leading-6 text-muted-foreground">The taste AI behind every busk: who&apos;s out at each pitch, and what they like.</p>
      </div>

      {/* Built with: a logo wall; each cell names the partner and its role for screen readers and on hover. */}
      <div className="flex flex-col items-center gap-4">
        <h3 className="m-0 font-mono text-xs leading-4 font-bold tracking-[0.12em] text-muted-foreground uppercase">Built with</h3>
        <ul aria-label="Built with" className="m-0 grid w-full list-none grid-cols-[repeat(auto-fill,minmax(min(180px,100%),1fr))] gap-px border-2 border-rule bg-border p-0">
          {partners.map((p) => (
            <li key={p.name} className="flex bg-card">
              <a
                href={p.href}
                title={`${p.name}: ${p.role}`}
                className="flex min-h-24 w-full items-center justify-center px-4 text-foreground no-underline hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none"
              >
                <LogoSlot partner={p} />
                <span className="sr-only">
                  {p.name}: {p.role}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
