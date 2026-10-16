import type { IconName } from "@/components/honeycomb/icon";

export type NavId = "busks";

export type NavItem = {
  id: NavId;
  label: string;
  href: string;
  /** A DS Icon name (never a Lucide component or a text glyph). */
  icon: IconName;
  /** Paths (and anything below them) that light this item up. */
  match: readonly string[];
};

/**
 * The main nav holds features only, and Busks is the only one (Week was removed, Tips too, a "rate your busks" feature comes later; Brain and Brand live in the footer). Busks is the plan page and the form that starts it:
 * /busks, /plan and a stored busk at /p/<id> all light it up. There is no Setlist route.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "busks", label: "Busks", href: "/busks", icon: "map", match: ["/busks", "/plan", "/p"] },
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

/** The bottom bar needs two or more items; with one, the header carries it on every width and nothing is padded for a bar. */
export const HAS_BOTTOM_NAV = NAV_ITEMS.length > 1;
