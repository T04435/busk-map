import { Check, RefreshCw } from "lucide-react";
import { EvidenceLine } from "@/components/honeycomb/evidence-line";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";
import { agentVsEngineTitle, becauseClause } from "@/lib/agent-vs-engine";
import type { Plan } from "@/lib/plan-schema";
import { modelName, type ExplanationsModel } from "@/lib/sources";

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/**
 * Above the research: did the model keep Busk Map's own top 3, or change it, and why. Keeping it is the common case, so it shows
 * the three pitches ticked. "Agent vs engine" stays only as the small mono label (brand words: busk-facing copy says "Busk Map").
 */
export function AgentVsEngine({ agent, model, level = 2 }: { agent: NonNullable<Plan["agent"]>; model: ExplanationsModel | null; /** The heading level: 2 when it stands under the page title, 3 inside "The research" (B-048). */ level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  const kept = agent.changes.length === 0;
  const where = (p: { engineRank: number | null }) => (p.engineRank === null ? `added by ${modelName(model)}` : `Busk Map's no. ${p.engineRank}`);
  return (
    <section data-testid="agent-vs-engine" aria-label="The model and Busk Map's scores" className="flex flex-col gap-3 border-2 border-rule bg-card px-4 py-3">
      <div className="flex items-start gap-3">
        <HexCell size={36} tone={kept ? "default" : "primary"}>
          {kept ? <Check aria-hidden="true" className="size-4" /> : <RefreshCw aria-hidden="true" className="size-4" />}
        </HexCell>
        <div className="min-w-0">
          <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Agent vs engine</span>
          <Heading className="m-0 font-display text-[24px] leading-none font-extrabold uppercase" data-testid="agent-vs-engine-title">
            {agentVsEngineTitle(agent.changes.length, model)}
          </Heading>
          {kept ? <p className="m-0 mt-1 text-sm text-muted-foreground">Kept after checking the crowd, foot traffic, events nearby and the rules.</p> : null}
        </div>
      </div>
      {kept ? (
        <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
          {agent.engineTop.slice(0, 3).map((p, i) => (
            <li key={p.id} className="flex min-w-0 items-center gap-2 border border-border bg-secondary px-2 py-1.5 max-sm:w-full">
              <RankTile n={i + 1} size="sm" />
              <span className="min-w-0 flex-1 text-sm font-bold">{p.name}</span>
              <PercentCell value={p.score} size={32} label="Score" />
              <Check aria-label="Kept" className="size-4" strokeWidth={2.5} />
            </li>
          ))}
        </ol>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {agent.changes.map((c) => (
            <li key={c.position} className="flex items-start gap-3" data-testid="agent-vs-engine-change">
              <RankTile n={c.position} size="sm" />
              <div className="min-w-0">
                <p className="m-0 flex flex-wrap items-baseline gap-x-2">
                  <b>{c.pick.name}</b>
                  <span className="font-mono text-xs text-muted-foreground">
                    {where(c.pick)} · {c.pick.score}
                  </span>
                  {c.over ? (
                    <>
                      <span className="font-mono text-xs font-bold uppercase">over</span>
                      <s>{c.over.name}</s>
                      <span className="font-mono text-xs text-muted-foreground">
                        {where(c.over)} · {c.over.score}
                      </span>
                    </>
                  ) : null}
                </p>
                {c.reason ? <p className="m-0 text-muted-foreground">Because {becauseClause(c.reason)}.</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {agent.added.length > 0 ? <EvidenceLine>Added by {modelName(model)} and scored by Busk Map: {list(agent.added)}.</EvidenceLine> : null}
    </section>
  );
}
