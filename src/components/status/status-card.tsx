import type { ReactNode } from "react";
import { MapPin, TriangleAlert } from "lucide-react";
import { HexCell } from "@/components/honeycomb/hex-cell";

/**
 * The card behind every not-found and error page (site-wide 404, /p/<id> not found, error.tsx, global-error.tsx), so
 * they match. A honeycomb cell lifted by an orange offset (a dashed cell with a pin for not-found, a destructive cell for
 * errors), the title in display caps, one sentence, a footnote in mono, the actions. No hooks: usable from server and
 * client components. The title is styled from the wrapper so the markup stays a plain <h1>.
 */
export function StatusCard({
  title,
  description,
  actions,
  footnote,
  testId,
  tone = "notfound",
  embedded = false,
  numeral,
}: {
  title: string;
  description: string;
  actions: ReactNode;
  /** A small line under the description, e.g. an error reference code. */
  footnote?: ReactNode;
  testId: string;
  tone?: "notfound" | "error";
  /** Show the card inside another page (the brand page): no <main>, and the title is an <h3>. */
  embedded?: boolean;
  /** A large decorative number above the card (the app 404's "404"). */
  numeral?: string;
}) {
  const error = tone === "error";
  const Title = embedded ? "h3" : "h1";
  const Wrapper = embedded ? "div" : "main";
  return (
    <Wrapper {...(embedded ? {} : { id: "main" })} className={embedded ? "w-full" : "mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-8 md:py-12"}>
      {numeral && !embedded ? (
        <p aria-hidden="true" className="m-0 text-center font-display text-[clamp(96px,20vw,160px)] leading-[0.85] font-extrabold text-signal-text">
          {numeral}
        </p>
      ) : null}
      <section
        data-testid={testId}
        data-tone={tone}
        role={error ? (embedded ? "group" : "alert") : undefined}
        className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 border-2 border-rule bg-card p-6 text-center shadow-md md:px-6 md:py-10 [&_h1]:m-0 [&_h1]:font-display [&_h1]:text-[clamp(40px,7vw,56px)] [&_h1]:leading-[0.95] [&_h1]:font-extrabold [&_h1]:uppercase [&_h3]:m-0 [&_h3]:font-display [&_h3]:text-[clamp(40px,7vw,56px)] [&_h3]:leading-[0.95] [&_h3]:font-extrabold [&_h3]:uppercase"
      >
        <HexCell size={72} tone={error ? "error" : "dashed"} lift>
          {error ? <TriangleAlert className="size-[30px]" aria-hidden="true" /> : <MapPin className="size-[30px]" aria-hidden="true" />}
        </HexCell>
        <Title>{title}</Title>
        <p className="m-0 text-[17px] leading-[26px]">{description}</p>
        <div className="flex w-full flex-wrap justify-center gap-3 [&>*]:max-sm:w-full">{actions}</div>
        {footnote ? <p className="m-0 w-full border-t border-border pt-4 font-mono text-[13px] leading-4 font-medium text-muted-foreground">{footnote}</p> : null}
      </section>
    </Wrapper>
  );
}
