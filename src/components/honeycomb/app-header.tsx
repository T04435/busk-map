"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Logo } from "@/components/honeycomb/logo";
import { activeNavId, NAV_ITEMS } from "@/components/honeycomb/nav-items";

/**
 * The header from 768px up: the lockup, then the four destinations. Always bluestone with the 4px orange rule under it,
 * in day and night. The active item is boxed in orange and says `aria-current="page"`. Below 768px MobileNav takes over.
 */
export function AppHeaderView({ pathname }: { pathname: string | null }) {
  const active = activeNavId(pathname);
  return (
    <header data-slot="app-header" className="hidden h-16 shrink-0 items-center gap-6 border-b-4 border-primary bg-bluestone px-6 text-[#f2ede4] md:flex">
      <Link href="/" className="flex h-tap items-center rounded-none focus-visible:shadow-[0_0_0_2px_#141c21,0_0_0_4px_#f2ede4]">
        <Logo size={28} bare className="text-[#f2ede4]" />
      </Link>
      <nav aria-label="Main" className="flex gap-1">
        {NAV_ITEMS.map((item) => {
          const on = item.id === active;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-tap items-center gap-2 px-3 font-mono text-xs font-bold tracking-[0.05em] uppercase transition-colors focus-visible:shadow-[0_0_0_2px_#141c21,0_0_0_4px_#f2ede4]",
                on ? "bg-primary text-primary-foreground" : "text-[#a7b0b5] hover:bg-[#232d33] hover:text-[#f2ede4]"
              )}
            >
              <item.icon aria-hidden="true" className="size-[18px]" />
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
