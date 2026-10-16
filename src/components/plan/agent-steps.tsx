"use client";

import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInput, scalar, type AgentStep } from "@/lib/agent-steps";
import { modelName, type ExplanationsModel } from "@/lib/sources";

/**
 * The agent's steps as they stream (and as a replay shows them): for each
 * step, Claude's notes before the call, the tool and the inputs Claude chose,
 * and the data the tool returned, as the model saw it. No design yet: plain
 * shadcn components.
 */
export { applyStreamEvent, formatInput, type AgentStep, type RunUsage, type StepNote } from "@/lib/agent-steps";

const isRowList = (v: unknown): v is Record<string, unknown>[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => x !== null && typeof x === "object" && !Array.isArray(x));

function RowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c} className="h-8">
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {columns.map((c) => (
              <TableCell key={c} className="max-w-64 py-1 break-words whitespace-normal">
                {scalar(row[c])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** The data a tool returned, as it is: scalars in a key/value table, lists of rows as tables, anything else as JSON. */
export function StepData({ value }: { value: unknown }) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return isRowList(value) ? <RowsTable rows={value} /> : <pre className="overflow-x-auto text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([k]) => k !== "summary");
  const isFlat = (v: unknown) => v === null || typeof v !== "object" || (Array.isArray(v) && v.every((x) => x === null || typeof x !== "object"));
  const flat = entries.filter(([, v]) => isFlat(v));
  const tables = entries.filter(([, v]) => isRowList(v));
  const nested = entries.filter(([, v]) => !isFlat(v) && !isRowList(v));
  return (
    <div className="space-y-3">
      {flat.length > 0 && <RowsTable rows={[Object.fromEntries(flat)]} />}
      {tables.map(([k, rows]) => (
        <div key={k} className="space-y-1">
          <p className="text-xs font-medium">{k}</p>
          <RowsTable rows={rows as Record<string, unknown>[]} />
        </div>
      ))}
      {nested.map(([k, v]) => (
        <div key={k} className="space-y-1">
          <p className="text-xs font-medium">{k}</p>
          <pre className="overflow-x-auto text-xs whitespace-pre-wrap">{JSON.stringify(v, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

const STATUS: Record<AgentStep["status"], string> = { running: "running", done: "done", failed: "failed", notes: "note" };

/** `model` names who wrote each note: Claude, or the test model offline (B-010). */
export function AgentSteps({ steps, model = null }: { steps: AgentStep[]; model?: ExplanationsModel | null }) {
  if (steps.length === 0) return null;
  const numbers = new Map<string, number>();
  for (const step of steps) if (step.tool) numbers.set(step.id, numbers.size + 1);
  return (
    <ol className="space-y-3 text-sm" aria-live="polite" aria-label="Agent steps">
      {steps.map((step) => (
        <li key={step.id} className="space-y-2 rounded-lg border p-3" data-testid="agent-step" data-tool={step.tool ?? ""}>
          <div className="flex flex-wrap items-center gap-2">
            {step.tool && <span className="text-muted-foreground">{numbers.get(step.id)}.</span>}
            <span className="font-medium">{step.label}</span>
            <Badge variant="outline">{step.tool === "finish_plan" && step.status === "failed" ? "rejected" : STATUS[step.status]}</Badge>
          </div>
          {step.notes.map((note, i) => (
            <p key={i} className="whitespace-pre-line text-muted-foreground" data-testid={`agent-note-${note.kind}`}>
              <span className="font-medium">{note.kind === "reasoning" ? "Thinking (summary): " : `${modelName(model, "label")}: `}</span>
              {note.text}
            </p>
          ))}
          {step.tool && (
            <p className="break-words">
              <code className="font-mono text-xs">{step.tool}</code> <span className="text-muted-foreground">{formatInput(step.input)}</span>
            </p>
          )}
          {step.source && <p className="text-xs text-muted-foreground">{step.source}</p>}
          {step.summary && <p>{step.summary}</p>}
          {step.output !== undefined && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="link" size="sm" className="group h-auto px-0 text-muted-foreground">
                  <ChevronRightIcon aria-hidden className="transition-transform group-data-[state=open]:rotate-90" />
                  Data returned
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 overflow-x-auto" data-testid="agent-step-data">
                <StepData value={step.output} />
              </CollapsibleContent>
            </Collapsible>
          )}
          <span className="sr-only">{step.status}</span>
        </li>
      ))}
    </ol>
  );
}
