import Link from "next/link";
import { Calendar, Scale, ShieldOff } from "lucide-react";
import { HexCell } from "@/components/honeycomb/hex-cell";
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
    <section data-testid="no-pitch" role="status" className="flex flex-col items-start gap-4 border-2 border-rule bg-card p-5 sm:flex-row sm:p-6">
      <HexCell size={56} tone="error">
        <ShieldOff aria-hidden="true" className="size-6" />
      </HexCell>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h2 className="m-0 font-display text-[clamp(28px,4vw,36px)] leading-none font-extrabold uppercase">No legal pitch for {WHO[permit] ?? permitName(permit)} {when}</h2>
        <p className="m-0 max-w-[60ch] text-base leading-6">
          The council&apos;s busking rules left no pitch for this slot.{" "}
          {general ? "A different day or time may open some." : "A general permit opens more spots in most slots, or another day may."}{" "}
          {rulesHref ? (
            <a href={rulesHref} target="_blank" rel="noreferrer" className="inline-flex min-h-tap items-center font-bold underline underline-offset-3">
              Read the council&apos;s busking rules
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-3 [&>*]:max-sm:w-full">
          {general ? null : (
            <Button asChild>
              <Link href={`${againHref}${againHref.includes("?") ? "&" : "?"}permit=general`}>
                <Scale aria-hidden="true" />
                Try with a general permit
              </Link>
            </Button>
          )}
          <Button asChild variant={general ? "default" : "outline"}>
            <Link href={againHref}>
              <Calendar aria-hidden="true" />
              Pick another day
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
