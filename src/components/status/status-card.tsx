import type { ReactNode } from "react";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";

/**
 * The card behind every not-found and error page (site-wide 404, /p/<id> not found, error.tsx, global-error.tsx), so
 * they match. A honeycomb cell lifted by an offset (72px: dashed with a pin for not-found, the error tone with a warning for errors; the DS StatusCard), the title in display caps, one sentence, a footnote in mono, the actions. No hooks: usable from server and
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
    <Wrapper {...(embedded ? {} : { id: "main" })} className={embedded ? "w-full" : "mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center gap-4 px-4 py-8 md:px-6 md:py-16"}>
      {numeral && !embedded ? (
        <p aria-hidden="true" className="m-0 text-left font-display text-[clamp(96px,20vw,160px)] leading-[0.85] font-extrabold text-signal-text">
          {numeral}
        </p>
      ) : null}
      <section
        data-testid={testId}
        data-tone={tone}
        role={error ? (embedded ? "group" : "alert") : undefined}
        className="mr-auto flex w-full max-w-[560px] flex-col items-start gap-4 border-2 border-rule bg-card p-6 text-left [&_h1]:m-0 [&_h1]:font-display [&_h1]:text-[clamp(40px,7vw,56px)] [&_h1]:leading-[0.95] [&_h1]:font-extrabold [&_h1]:uppercase [&_h3]:m-0 [&_h3]:font-display [&_h3]:text-[clamp(40px,7vw,56px)] [&_h3]:leading-[0.95] [&_h3]:font-extrabold [&_h3]:uppercase"
      >
        <HexCell size={72} tone={error ? "error" : "dashed"} lift>
          <Icon name={error ? "warning" : "pin"} size={30} />
        </HexCell>
        <Title>{title}</Title>
        <p className="m-0 text-[17px] leading-[26px] text-foreground">{description}</p>
        {footnote ? <p className="m-0 font-mono text-xs leading-4 font-medium text-muted-foreground">{footnote}</p> : null}
        <div className="flex flex-wrap gap-3 max-sm:w-full max-sm:[&>*]:w-full">{actions}</div>
      </section>
    </Wrapper>
  );
}
