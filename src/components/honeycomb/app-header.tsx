"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Logo } from "@/components/honeycomb/logo";
import { Icon } from "@/components/honeycomb/icon";
import { activeNavId, HAS_BOTTOM_NAV, NAV_ITEMS } from "@/components/honeycomb/nav-items";

/**
 * The header on every page: the lockup, and from 721px up the destinations (all widths while there is no bottom bar). Always bluestone with the 4px orange
 * rule under it, in day and night. The active item is boxed in orange and says `aria-current="page"`. Below 721px the
 * header is the compact bar (lockup only) and MobileNav carries the destinations at the bottom.
 */
export function AppHeaderView({ pathname }: { pathname: string | null }) {
  const active = activeNavId(pathname);
  return (
    <header data-slot="app-header" data-theme="dark" className="flex h-16 shrink-0 items-center gap-6 border-b-4 border-primary bg-bluestone px-4 text-[#f2ede4] md:px-6">
      <Link href="/" aria-label="Busk Map home" className="flex h-tap items-center rounded-none focus-visible:ring-2 focus-visible:ring-ring">
        <Logo size={36} ground="dark" />
      </Link>
      <nav aria-label="Main" className={cn("gap-1", HAS_BOTTOM_NAV ? "hidden min-[721px]:flex" : "flex")}>
        {NAV_ITEMS.map((item) => {
          const on = item.id === active;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-tap items-center gap-2 px-3 font-mono text-xs font-bold tracking-[0.05em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                on ? "bg-primary text-primary-foreground" : "text-[#a7b0b5] hover:bg-[#232d33] hover:text-[#f2ede4]"
              )}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function AppHeader() {
  return <AppHeaderView pathname={usePathname()} />;
}
