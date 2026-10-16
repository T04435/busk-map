import { CalendarDays, Brain, Map, type LucideIcon } from "lucide-react";

export type NavId = "busks" | "week" | "brain";

export type NavItem = {
  id: NavId;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Paths (and anything below them) that light this item up. */
  match: readonly string[];
};

/**
 * The three destinations (Busks, Week, Brain; Tips was removed from the app UI, a "rate your busks" feature comes later). Busks is the plan page and the form that starts it:
 * /busks, /plan and a stored busk at /p/<id> all light it up. There is no Setlist route.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "busks", label: "Busks", href: "/busks", icon: Map, match: ["/busks", "/plan", "/p"] },
  { id: "week", label: "Week", href: "/week", icon: CalendarDays, match: ["/week"] },
  { id: "brain", label: "Brain", href: "/brain", icon: Brain, match: ["/brain"] },
];

/** Which item a pathname belongs to, or null (the landing page, not-found pages) when none does. */
export function activeNavId(pathname: string | null | undefined): NavId | null {
  if (!pathname) return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const item of NAV_ITEMS) {
    if (item.match.some((m) => path === m || path.startsWith(`${m}/`))) return item.id;
  }
  return null;
}
