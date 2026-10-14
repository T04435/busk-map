import type { PlanStreamEvent } from "@/lib/plan-schema";

export type AgentStep = { id: string; tool: string; label: string; status: "running" | "done" | "failed"; summary?: string };

/** Fold stream events into a list of steps. */
export function applyStreamEvent(steps: AgentStep[], event: PlanStreamEvent): AgentStep[] {
  if (event.type === "tool-start") return [...steps, { id: event.id, tool: event.tool, label: event.label, status: "running" }];
  if (event.type === "tool-end") {
    return steps.map((s) => (s.id === event.id ? { ...s, status: event.ok ? "done" : "failed", summary: event.summary } : s));
  }
  return steps;
}

export function AgentSteps({ steps }: { steps: AgentStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="space-y-1 text-sm" aria-live="polite" aria-label="Agent steps">
      {steps.map((step) => (
        <li key={step.id} className="flex flex-wrap gap-x-2">
          <span aria-hidden>{step.status === "running" ? "…" : step.status === "done" ? "✓" : "✗"}</span>
          <span className="font-medium">{step.label}</span>
          {step.summary && <span className="text-muted-foreground">{step.summary}</span>}
          <span className="sr-only">{step.status}</span>
        </li>
      ))}
    </ol>
  );
}
