"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Logo } from "@/components/honeycomb/logo";
import { OsmCredit } from "@/components/honeycomb/osm-credit";
import { VersionBadge } from "@/components/honeycomb/version-badge";

const REPO = "https://github.com/T04435/busk-map";
const AUTHOR = "https://github.com/T04435";

/** GitHub's mark, as a single path (24-unit grid). */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const SITE_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Brain", href: "/brain" },
  { label: "Brand", href: "/brand" },
] as const;

const LINK = "inline-flex min-h-tap items-center font-bold text-foreground underline underline-offset-3 hover:decoration-2";

/**
 * The footer on every page, in three parts: on the left the wordmark and the map credit, in the centre Privacy, Brain and Brand,
 * on the right GitHub (an icon in a cell) and "Built by T04435" with the pixel critter, and on a line of its own at the bottom, centred, the running version (VersionBadge), above it the Qloo taste-data credit and disclaimer in plain text. At 390px the parts stack. The legal line
 * lives on /terms, which the footer links to. On the landing (`dark`) it continues the closing call to action's dark band, as in
 * the deck; on every other page it sits on paper.
 */
export function SiteFooterView({ repo = REPO, dark = false, night = false }: { repo?: string; dark?: boolean; night?: boolean }) {
  return (
    <footer data-slot="site-footer" data-theme={dark || night ? "dark" : undefined} className={cn(dark && "bm-grain bg-background text-foreground", night && !dark && "bg-background text-foreground")}>
      <div
        className={cn(
          "grid items-center gap-x-6 gap-y-4 border-t border-border text-[13px] leading-5 text-muted-foreground md:grid-cols-[1fr_auto_1fr]",
          dark ? "mx-auto max-w-[1360px] px-4 pt-6 pb-10 md:px-6" : "p-6"
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/" aria-label="Busk Map home" className="inline-flex h-tap items-center">
            <Logo size={34} />
          </Link>
          <OsmCredit />
        </div>
        <nav aria-label="Site" className="flex flex-wrap items-center gap-x-2 md:justify-center">
          {SITE_LINKS.map((l, i) => (
            <span key={l.href} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">·</span>}
              <Link className={LINK} href={l.href}>
                {l.label}
              </Link>
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:justify-end">
          <a href={repo} aria-label="Busk Map on GitHub" className="inline-flex size-tap items-center justify-center text-foreground">
            <HexCell size={40} fontSize={20}>
              <GithubMark className="size-5" />
            </HexCell>
          </a>
          <span className="inline-flex items-center gap-2">
            <span>Built by</span>
            <a className={LINK} href={AUTHOR}>
              T04435
            </a>
          </span>
        </div>
        {/* The Qloo credit and disclaimer, in plain text only (no Qloo logo, no partner wording): once, here, on every page. */}
        <p data-testid="qloo-disclaimer" className="m-0 text-center md:col-span-3">
          Taste data from the Qloo API. Busk Map is not affiliated with or endorsed by Qloo.
        </p>
        <div className="flex justify-center md:col-span-3">
          <VersionBadge />
        </div>
      </div>
    </footer>
  );
}

/** The landing's footer is dark; usePathname() reads the request on dynamic routes, so the layout wraps this in Suspense with the paper footer as fallback. */
export function SiteFooter() {
  const pathname = usePathname();
  return <SiteFooterView dark={pathname === "/"} night={pathname === "/brain" || pathname?.startsWith("/brain/")} />;
}
