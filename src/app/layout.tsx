import type { Metadata } from "next";
import { Suspense } from "react";
import { Atkinson_Hyperlegible_Next, Big_Shoulders, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppHeader, AppHeaderView } from "@/components/honeycomb/app-header";
import { HAS_BOTTOM_NAV } from "@/components/honeycomb/nav-items";
import { MobileNav, MobileNavView } from "@/components/honeycomb/mobile-nav";
import { SiteFooter, SiteFooterView } from "@/components/honeycomb/site-footer";
import { versionText } from "@/lib/version";

// Honeycomb's three families (design-handoff/fonts.md). Google renamed "Big Shoulders Display" to "Big Shoulders" (the same
// family, now with an optical-size axis), so next/font imports it under the new name; the CSS stack still names both. globals.css pins opsz to 72, the Display cut. globals.css reads the -src variables and adds the fallback stacks.
const display = Big_Shoulders({ subsets: ["latin"], weight: "variable", axes: ["opsz"], variable: "--font-display-src" });
const sans = Atkinson_Hyperlegible_Next({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-sans-src" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono-src" });

const TITLE = "Busk Map";
const DESCRIPTION =
  "Know where to play, and what to play there. A taste-aware pitch planner for street performers, powered by Qloo.";

/** Absolute URLs for the social images: the production domain on Vercel, localhost elsewhere. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
const OG_IMAGE = { url: "/brand/social/og-image-1200x630.png", width: 1200, height: 630, alt: "Busk Map: where to busk. When. What to play." };

// The favicon, apple touch icon and 512px app icon come from the file conventions (src/app/icon.svg, icon1.png, icon2.png, apple-icon.png, favicon.ico).
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: TITLE, title: TITLE, description: DESCRIPTION, locale: "en_AU", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }] },
  other: { "app-version": versionText() },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      {/* Under 721px the fixed bottom nav would cover the end of the page: pad by its height (plus the safe area). */}
      <body className={HAS_BOTTOM_NAV ? "flex min-h-full flex-col pb-[calc(var(--size-nav)+env(safe-area-inset-bottom))] min-[721px]:pb-0" : "flex min-h-full flex-col"}>
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-[60] focus-visible:border-2 focus-visible:border-rule focus-visible:bg-card focus-visible:px-4 focus-visible:py-3 focus-visible:font-bold"
        >
          Skip to content
        </a>
        {/* usePathname() reads the request on dynamic routes: the Suspense fallback is the same nav with no active item. */}
        <Suspense fallback={<AppHeaderView pathname={null} />}>
          <AppHeader />
        </Suspense>
        {children}
        {/* Before the footer in DOM and tab order (B-233); it is position: fixed, so it still sits at the bottom. */}
        <Suspense fallback={<MobileNavView pathname={null} />}>
          <MobileNav />
        </Suspense>
        <Suspense fallback={<SiteFooterView />}>
          <SiteFooter />
        </Suspense>
      </body>
    </html>
  );
}
