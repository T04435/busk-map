import type { ReactNode } from "react";
import { CircleAlert, MapPin } from "lucide-react";
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
}) {
  const error = tone === "error";
  const Title = embedded ? "h3" : "h1";
  const Wrapper = embedded ? "div" : "main";
  return (
    <Wrapper {...(embedded ? {} : { id: "main" })} className={embedded ? "w-full" : "mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:py-12"}>
      <section
        data-testid={testId}
        data-tone={tone}
        role={error ? (embedded ? "group" : "alert") : undefined}
        className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 border-2 border-rule bg-card p-6 [&_h1]:m-0 [&_h1]:font-display [&_h1]:text-[clamp(40px,7vw,56px)] [&_h1]:leading-[0.95] [&_h1]:font-extrabold [&_h1]:uppercase [&_h3]:m-0 [&_h3]:font-display [&_h3]:text-[clamp(40px,7vw,56px)] [&_h3]:leading-[0.95] [&_h3]:font-extrabold [&_h3]:uppercase"
      >
        <HexCell size={72} tone={error ? "error" : "dashed"} lift>
          {error ? <CircleAlert className="size-[30px]" aria-hidden="true" /> : <MapPin className="size-[30px]" aria-hidden="true" />}
        </HexCell>
        <Title>{title}</Title>
        <p className="m-0 text-[17px] leading-[26px]">{description}</p>
        {footnote ? <p className="m-0 font-mono text-xs leading-4 font-medium text-muted-foreground">{footnote}</p> : null}
        <div className="flex w-full flex-wrap gap-3 [&>*]:max-sm:w-full">{actions}</div>
      </section>
    </Wrapper>
  );
}
