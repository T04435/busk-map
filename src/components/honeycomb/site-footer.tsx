import { Logo, QlooWordmark } from "@/components/honeycomb/logo";

const REPO = "https://github.com/T04435/busk-map";

/**
 * The footer on every page: the lockup, "Taste data by Qloo · MIT licence", the open-source line and the legal line.
 * The legal line always shows.
 */
export function SiteFooter({ repo = REPO }: { repo?: string }) {
  return (
    <footer data-slot="site-footer" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border p-6 text-[13px] leading-5 text-muted-foreground">
      <Logo variant="lockup" size={28} />
      <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
        Taste data by <QlooWordmark width={44} /> · MIT licence
      </span>
      <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <b className="font-display text-base leading-none font-extrabold text-foreground uppercase">Open source</b>
        <a className="text-foreground underline underline-offset-3 hover:decoration-2" href={repo}>
          {repo.replace(/^https?:\/\//, "")}
        </a>
        <span>
          Built by{" "}
          <a className="text-foreground underline underline-offset-3 hover:decoration-2" href="https://github.com/T04435">
            T04435
          </a>{" "}
          (solo), with Claude, during the Qloo Agentic Hackathon
        </span>
      </span>
      <span className="basis-full">Busk Map never confirms a pitch is legal: check your permit conditions.</span>
    </footer>
  );
}
