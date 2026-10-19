import Link from "next/link";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { Button } from "@/components/ui/button";
import { permitName } from "@/lib/slot";

const WHO: Record<string, string> = { general: "a general permit", premium: "a premium permit", "circle-act": "a circle act" };

/**
 * "No legal pitch": the council's rules left nothing for this permit and slot. A bordered card (board N02) with the way out:
 * plan again on a general permit (when the act isn't on one) or pick another day, both pre-filling /busks from the stored busk.
 */
export function NoPitchPanel({ permit, when, againHref, rulesHref }: { permit: string; when: string; againHref: string; rulesHref?: string }) {
  const general = permit === "general";
  return (
    <section data-testid="no-pitch" role="status" className="border-2 border-rule bg-card">
      <div className="grid justify-items-center gap-3 px-4 py-8 text-center">
        <HexCell size={64} lift>
          <Icon name="restricted" size={28} />
        </HexCell>
        <h2 className="m-0 font-display text-xl leading-[26px] font-extrabold tracking-[0.01em] uppercase">No pitch open for {WHO[permit] ?? permitName(permit)} {when}</h2>
        <p className="m-0 max-w-[36ch] text-[15px] leading-[22px] text-muted-foreground">
          {general ? "The council's rules leave no pitch for this slot: try another day or time." : "The council's rules leave no pitch for this permit and slot: try a general permit or another day."}{" "}
          {rulesHref ? (
            <a href={rulesHref} target="_blank" rel="noreferrer" className="inline-flex min-h-tap items-center font-bold text-foreground underline underline-offset-3">
              Read the council&apos;s busking rules
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </p>
        <div className="flex flex-wrap justify-center gap-3 [&>*]:max-sm:w-full">
          {general ? null : (
            <Button asChild>
              <Link href={`${againHref}${againHref.includes("?") ? "&" : "?"}permit=general`}>
                <Icon name="legal" size={16} />
                Plan with a general permit
              </Link>
            </Button>
          )}
          <Button asChild variant={general ? "default" : "outline"}>
            <Link href={againHref}>
              <Icon name="calendar" size={16} />
              Try another day
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
