import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

type BadgeTone = React.ComponentProps<typeof Badge>["variant"];

/**
 * The top of every app page: a back link, the meta line, the title, a row of status badges and side links.
 * The title is display caps; `end` is the right-hand slot (CopyLinkButton on a stored busk).
 */
export function PageHeader({
  back,
  meta,
  title,
  subtitle,
  badges,
  links,
  end,
  className,
}: {
  back?: { href?: string; label?: string } | false;
  /** Mono caps: city · slot · permit. */
  meta?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: { label: ReactNode; tone?: BadgeTone; testId?: string }[];
  links?: { label: ReactNode; href: string }[];
  end?: ReactNode;
  className?: string;
}) {
  return (
    <header data-slot="page-header" className={cn("flex min-w-0 flex-col gap-3", className)}>
      {back === false ? null : (
        <Link className="self-start font-mono text-sm font-bold underline underline-offset-3 hover:decoration-2" href={back?.href ?? "/"}>
          {back?.label ?? "Busk Map home"}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          {meta ? <span className="font-mono text-xs leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase">{meta}</span> : null}
          <h1 className="text-[clamp(40px,6vw,56px)] leading-[0.95] font-extrabold break-words uppercase font-display">{title}</h1>
          {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
        </div>
        {end ? <div>{end}</div> : null}
      </div>
      {badges?.length ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {badges.map((b, i) => (
            <Badge key={i} variant={b.tone ?? "neutral"} data-testid={b.testId}>
              {b.label}
            </Badge>
          ))}
        </div>
      ) : null}
      {links?.length ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {links.map((l, i) => (
            <Link key={i} className="font-bold underline underline-offset-3 hover:decoration-2" href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
