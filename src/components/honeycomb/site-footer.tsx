"use client";

import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Logo, QlooWordmark } from "@/components/honeycomb/logo";

const REPO = "https://github.com/T04435/busk-map";

/**
 * The footer on every page: the lockup, "Taste data by Qloo · MIT licence", the open-source line and the legal line.
 * The legal line always shows. On the landing (`dark`) it continues the closing call to action's dark band, as in the deck;
 * on every other page it sits on paper. There is no "Brand" link: /brand is reached by its address (decision 121).
 */
export function SiteFooterView({ repo = REPO, dark = false }: { repo?: string; dark?: boolean }) {
  return (
    <footer data-slot="site-footer" data-theme={dark ? "dark" : undefined} className={cn(dark && "bm-grain bg-background text-foreground")}>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border text-[13px] leading-5 text-muted-foreground",
          dark ? "mx-auto max-w-[1360px] px-4 pt-6 pb-10 md:px-6" : "p-6"
        )}
      >
        <Logo variant="lockup" size={28} />
        <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
          Taste data by <QlooWordmark width={44} className="text-foreground" /> · MIT licence
        </span>
        <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <b className="font-display text-base leading-none font-extrabold text-foreground uppercase">Open source</b>
          <a className="text-signal-text underline underline-offset-3 hover:decoration-2" href={repo}>
            {repo.replace(/^https?:\/\//, "")}
          </a>
          <span>
            Built by{" "}
            <a className="text-foreground underline underline-offset-3 hover:decoration-2" href="https://github.com/T04435">
              T04435
            </a>{" "}
            (solo), with Claude, during the Qloo Agentic Hackathon
          </span>
        </span>
        <span className="basis-full">Busk Map never confirms a pitch is legal: check your permit conditions.</span>
      </div>
    </footer>
  );
}

/** The landing's footer is dark; usePathname() reads the request on dynamic routes, so the layout wraps this in Suspense with the paper footer as fallback. */
export function SiteFooter() {
  return <SiteFooterView dark={usePathname() === "/"} />;
}
