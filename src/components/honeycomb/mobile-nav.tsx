"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { activeNavId, NAV_ITEMS } from "@/components/honeycomb/nav-items";

/**
 * The bottom bar under 721px: the main navigation on phones. Three items, each at least 48px wide and the
 * full bar `size-nav` tall plus the safe-area inset. The current item says `aria-current="page"` and gets a boxed
 * orange tile behind its icon (with a 2px rule by day). Labels are mono caps.
 */
export function MobileNavView({ pathname }: { pathname: string | null }) {
  const active = activeNavId(pathname);
  return (
    <nav
      aria-label="Main"
      data-mobile-nav=""
      className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--size-nav)+env(safe-area-inset-bottom))] grid-cols-3 border-t-2 border-rule bg-card pb-[env(safe-area-inset-bottom)] min-[721px]:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const on = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex min-h-tap min-w-tap flex-col items-center justify-center gap-0.5 font-mono text-[11px] font-bold tracking-[0.05em] uppercase",
              on ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "grid h-[30px] w-12 place-items-center border-2 transition-colors duration-200 ease-out motion-reduce:transition-none",
                on ? "border-(--fill-rule) bg-primary text-primary-foreground" : "border-transparent"
              )}
            >
              <item.icon aria-hidden="true" className="size-[22px]" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  return <MobileNavView pathname={usePathname()} />;
}
