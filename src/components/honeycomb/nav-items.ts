import type { IconName } from "@/components/honeycomb/icon";

export type NavId = "busks" | "week" | "repertoire";

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
 * The main nav holds features only, Repertoire first (you set up your songs, then plan busks with them; user, 17 Oct), then
 * Busks, then Week (Plan my week, back in 1.3.0: the next 7 days in one run; /week and a planned week at /w/<id>). Tips were
 * removed; Brain and Brand live in the footer.
 * Busks is the plan page and the form that starts it: /busks, /plan and a stored busk at /p/<id> all light it up.
 * Repertoire is the songs you can sing and the songs to learn (/repertoire). There is no Setlist route.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "repertoire", label: "Repertoire", href: "/repertoire", icon: "music", match: ["/repertoire"] },
  { id: "busks", label: "Busks", href: "/busks", icon: "map", match: ["/busks", "/plan", "/p"] },
  { id: "week", label: "Week", href: "/week", icon: "week", match: ["/week", "/w"] },
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
