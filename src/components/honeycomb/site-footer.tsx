"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Logo, QlooWordmark } from "@/components/honeycomb/logo";

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

/**
 * The Claude Code critter, recreated as a pixel shape (not the Claude logo): a squat body with two eyes, a pair of arms and
 * four legs, on a 17 by 10 grid. It marks "Built by T04435" and links to the same place.
 */
function BuiltByMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 17 10" shapeRendering="crispEdges" className={className}>
      <g fill="#d77f5c">
        <rect x="2" y="0" width="13" height="7" />
        <rect x="0" y="4" width="17" height="2" />
        <rect x="2" y="7" width="1" height="3" />
        <rect x="4" y="7" width="1" height="3" />
        <rect x="12" y="7" width="1" height="3" />
        <rect x="14" y="7" width="1" height="3" />
      </g>
      <g fill="#1d2125">
        <rect x="4" y="2" width="1" height="2" />
        <rect x="12" y="2" width="1" height="2" />
      </g>
    </svg>
  );
}

const LINK = "inline-flex min-h-tap items-center font-bold text-foreground underline underline-offset-3 hover:decoration-2";

/**
 * The footer on every page, in three parts: on the left the wordmark and the Qloo credit, in the centre Privacy, Brain and Brand,
 * on the right GitHub (an icon in a cell) and "Built by T04435" with the pixel critter. At 390px the parts stack. The legal line
 * lives on /terms, which the footer links to. On the landing (`dark`) it continues the closing call to action's dark band, as in
 * the deck; on every other page it sits on paper.
 */
export function SiteFooterView({ repo = REPO, dark = false }: { repo?: string; dark?: boolean }) {
  return (
    <footer data-slot="site-footer" data-theme={dark ? "dark" : undefined} className={cn(dark && "bm-grain bg-background text-foreground")}>
      <div
        className={cn(
          "grid items-center gap-x-6 gap-y-4 border-t border-border text-[13px] leading-5 text-muted-foreground md:grid-cols-[1fr_auto_1fr]",
          dark ? "mx-auto max-w-[1360px] px-4 pt-6 pb-10 md:px-6" : "p-6"
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Logo size={22} />
          <span className="inline-flex items-center gap-2">
            with <QlooWordmark width={44} />
          </span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 md:justify-center">
          <Link className={LINK} href="/privacy">
            Privacy
          </Link>
          <Link className={LINK} href="/terms">
            Terms
          </Link>
          <Link className={LINK} href="/brain">
            Brain
          </Link>
          <Link className={LINK} href="/brand">
            Brand
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:justify-end">
          <a href={repo} aria-label="Busk Map on GitHub" className="inline-flex size-tap items-center justify-center text-foreground">
            <HexCell size={40} fontSize={20}>
              <GithubMark className="size-5" />
            </HexCell>
          </a>
          <span className="inline-flex items-center gap-2">
            <a className={LINK} href={AUTHOR}>
              Built by T04435
            </a>
            <a href={AUTHOR} aria-label="T04435 on GitHub" className="inline-flex size-tap items-center justify-center">
              <BuiltByMark className="h-5 w-auto" />
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

/** The landing's footer is dark; usePathname() reads the request on dynamic routes, so the layout wraps this in Suspense with the paper footer as fallback. */
export function SiteFooter() {
  return <SiteFooterView dark={usePathname() === "/"} />;
}
