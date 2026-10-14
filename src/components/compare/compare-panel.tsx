"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PlanRequest } from "@/lib/plan-schema";

type State = { status: "idle" | "loading" } | { status: "done"; text: string } | { status: "error"; message: string };

/** "What a plain LLM would suggest": one model call, no tools, no data. Clearly labelled. */
export function ComparePanel({ request }: { request: Pick<PlanRequest, "city" | "slot" | "performer"> }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });

  async function load() {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await response.json();
      if (!response.ok || !body.text) {
        setState({ status: "error", message: body?.error?.message ?? "The plain-LLM comparison is unavailable right now." });
        return;
      }
      setState({ status: "done", text: body.text });
    } catch {
      setState({ status: "error", message: "The plain-LLM comparison is unavailable right now." });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Switch
            id="compare"
            checked={open}
            onCheckedChange={(checked) => {
              setOpen(checked);
              if (checked && state.status === "idle") void load();
            }}
          />
          <Label htmlFor="compare">What a plain LLM would suggest</Label>
        </div>
        <CardDescription>
          The same question sent to Claude Haiku with no tools and no data: no Qloo, no sensors, no rules. Shown for comparison only.
        </CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="text-sm" aria-live="polite">
          {state.status === "loading" && <p className="text-muted-foreground">Asking a plain LLM…</p>}
          {state.status === "error" && <p className="text-muted-foreground">{state.message}</p>}
          {state.status === "done" && (
            <div>
              <p className="mb-2 font-medium">Plain LLM answer (unverified, no data)</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{state.text}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
