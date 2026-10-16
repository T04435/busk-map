import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Button } from "@/components/ui/button";

/** An unknown or malformed short plan id (board X01): no card, centred, at most 520px wide, a dashed pin cell and one way home. */
export default function PlanNotFound() {
  return (
    <>
      {/* The page's own metadata still says "Plan" (notFound() fires inside Suspense, after it resolved): React hoists this <title> over it (B-230). */}
      <title>Busk not found · Busk Map</title>
    <main id="main" className="mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <section data-testid="plan-not-found" className="flex flex-col items-center gap-4">
        <HexCell size={72} tone="dashed">
          <MapPin aria-hidden="true" className="size-[30px]" />
        </HexCell>
        <h1 className="m-0 font-display text-[clamp(36px,7vw,44px)] leading-[0.95] font-extrabold uppercase">We can&apos;t find this busk</h1>
        <p className="m-0 max-w-[42ch] text-[17px] leading-[26px] text-muted-foreground">The link may be cut short or mistyped. Check you copied all of it, or start a new busk.</p>
        <Button asChild className="max-sm:w-full">
          <Link href="/">
            Go to Busk Map home
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </main>
    </>
  );
}
