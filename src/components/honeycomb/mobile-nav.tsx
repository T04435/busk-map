"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Icon } from "@/components/honeycomb/icon";
import { activeNavId, HAS_BOTTOM_NAV, NAV_ITEMS } from "@/components/honeycomb/nav-items";

/**
 * The bottom bar under 721px: the main navigation on phones. Two or more items (hidden with one: the header carries it), each at least 48px wide and the
 * full bar `size-nav` tall plus the safe-area inset. The current item says `aria-current="page"` and gets a boxed
 * orange tile behind its icon (with a 2px rule by day). Labels are mono caps.
 */
export function MobileNavView({ pathname }: { pathname: string | null }) {
  const active = activeNavId(pathname);
  if (!HAS_BOTTOM_NAV) return null;
  return (
    <nav
      aria-label="Main"
      data-mobile-nav=""
      data-theme={pathname === "/brain" || pathname?.startsWith("/brain/") ? "dark" : undefined}
      className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--size-nav)+env(safe-area-inset-bottom))] grid-flow-col auto-cols-fr border-t-2 border-rule bg-card pb-[env(safe-area-inset-bottom)] min-[721px]:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const on = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex min-h-tap min-w-tap flex-col items-center justify-center gap-0.5 font-mono text-[11px] font-bold tracking-[0.05em] uppercase focus-visible:ring-0 focus-visible:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              on ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "grid h-[30px] w-12 place-items-center border-2 transition-colors duration-200 ease-out motion-reduce:transition-none",
                on ? "border-(--fill-rule) bg-primary text-primary-foreground" : "border-transparent"
              )}
            >
              <Icon name={item.icon} size={22} />
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
