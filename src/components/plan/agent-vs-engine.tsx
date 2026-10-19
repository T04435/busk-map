import { cn } from "cn";
import { EvidenceLine } from "@/components/honeycomb/evidence-line";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";
import { agentVsEngineTitle, becauseClause } from "@/lib/agent-vs-engine";
import type { Plan } from "@/lib/plan-schema";
import { modelName, type ExplanationsModel } from "@/lib/sources";

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** What the model looked at, when the caller doesn't say (the checks every busk runs). */
const DEFAULT_CHECKED = ["the crowd", "estimated activity", "events nearby", "the rules"];

/**
 * Above the research: did the model keep Busk Map's own top 3, or change it, and why. Keeping it is the common case, so it shows
 * the three pitches ticked, as a check that passed. "Agent vs engine" stays only as the small mono label (brand words: busk-facing
 * copy says "Busk Map"). Ported from the DS AgentVsEngine.
 */
export function AgentVsEngine({
  agent,
  model,
  level = 2,
  checked = DEFAULT_CHECKED,
}: {
  agent: NonNullable<Plan["agent"]>;
  model: ExplanationsModel | null;
  /** The heading level: 2 when it stands under the page title, 3 inside "The research" (B-048). */
  level?: 2 | 3;
  /** Plain phrases for what the model checked ("the crowd at 3 pitches", "activity at 1 pm"): "Kept after checking …". */
  checked?: string[];
}) {
  const Heading = level === 2 ? "h2" : "h3";
  const kept = agent.changes.length === 0;
  const where = (p: { engineRank: number | null }) => (p.engineRank === null ? `added by ${modelName(model)}` : `Busk Map's no. ${p.engineRank}`);
  return (
    <section
      data-testid="agent-vs-engine"
      aria-label="The model and Busk Map's scores"
      className={cn("grid gap-3 border-2 border-rule bg-card px-5 py-4", !kept && "shadow-[4px_4px_0_var(--primary)]")}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        <HexCell size={34} tone={kept ? "default" : "primary"}>
          <Icon name={kept ? "check" : "refresh"} size={16} strokeWidth={2.5} />
        </HexCell>
        <div className="min-w-0">
          <span className="font-mono text-[10px] leading-4 font-bold tracking-[0.08em] text-muted-foreground uppercase">Agent vs engine</span>
          <Heading className="m-0 font-display text-[22px] leading-6 font-extrabold uppercase" data-testid="agent-vs-engine-title">
            {agentVsEngineTitle(agent.changes.length, model)}
          </Heading>
          {checked.length ? (
            <p className="m-0 mt-0.5 text-sm leading-5 text-muted-foreground">
              {kept ? "Kept" : "Changed"} after checking {list(checked)}.
            </p>
          ) : null}
        </div>
      </div>
      {kept ? (
        <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
          {agent.engineTop.slice(0, 3).map((p, i) => (
            <li key={p.id} className="inline-flex items-center gap-2 border border-border bg-background py-1 pr-2.5 pl-1 text-sm font-bold max-sm:w-full">
              <RankTile n={i + 1} size="sm" />
              <span className="min-w-0 flex-1">{p.name}</span>
              <ScoreCell value={p.score} size="sm" label="Score" />
              <Icon name="check" size={16} strokeWidth={2.5} label="Kept" className="text-pitch-legal" />
            </li>
          ))}
        </ol>
      ) : (
        <ol className="m-0 grid list-none gap-3 p-0">
          {agent.changes.map((c) => (
            <li key={c.position} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3" data-testid="agent-vs-engine-change">
              <RankTile n={c.position} size="sm" />
              <div className="grid min-w-0 gap-1">
                <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px] leading-[22px]">
                  <b>{c.pick.name}</b>
                  <span className="font-mono text-[11px] leading-4 font-medium text-muted-foreground">
                    {where(c.pick)} · {c.pick.score}
                  </span>
                  {c.over ? (
                    <>
                      <span className="text-[13px] text-muted-foreground">over</span>
                      <s className="text-muted-foreground">{c.over.name}</s>
                      <span className="font-mono text-[11px] leading-4 font-medium text-muted-foreground">
                        {where(c.over)} · {c.over.score}
                      </span>
                    </>
                  ) : null}
                </p>
                {c.reason ? <p className="m-0 max-w-[70ch] text-sm leading-5 text-muted-foreground">Because {becauseClause(c.reason)}.</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {agent.added.length > 0 ? <EvidenceLine>Added by {modelName(model)} and scored by Busk Map: {list(agent.added)}.</EvidenceLine> : null}
    </section>
  );
}
