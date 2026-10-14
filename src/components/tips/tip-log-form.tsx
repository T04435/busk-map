"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { examplesForKey } from "@/lib/example-tips";
import { formatHour } from "@/lib/slot";
import { loadTips, newTipId, performerKeyFor, saveTips, tipEntrySchema } from "@/lib/tips";

type Props = {
  performerName: string;
  exampleId: string | null;
  slot: { date: string; startHour: number; endHour: number };
  /** Pitches to choose from: the plan's top pitches first, then the others. */
  pitches: { id: string; name: string }[];
  defaultPitchId: string | null;
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** "After your session": log what you earned at a pitch. Saved in this browser only. */
export function TipLogForm({ performerName, exampleId, slot, pitches, defaultPitchId }: Props) {
  const router = useRouter();
  const ids = useId();
  const [pitchId, setPitchId] = useState(defaultPitchId ?? pitches[0]?.id ?? "");
  const [date, setDate] = useState(slot.date);
  const [startHour, setStartHour] = useState(slot.startHour);
  const [endHour, setEndHour] = useState(slot.endHour);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const pitch = pitches.find((p) => p.id === pitchId);
    const value = Number(amount);
    if (!pitch) return setStatus({ ok: false, message: "Choose the pitch you played." });
    if (amount.trim() === "" || !Number.isFinite(value) || value < 0) return setStatus({ ok: false, message: "Enter what you earned, in dollars (0 or more)." });
    if (endHour <= startHour) return setStatus({ ok: false, message: "The session must end after it starts." });
    const entry = tipEntrySchema.safeParse({
      id: newTipId(),
      performerKey: performerKeyFor(performerName, exampleId),
      performerName,
      pitchId: pitch.id,
      pitchName: pitch.name,
      date,
      startHour,
      endHour,
      amount: Math.round(value * 100) / 100,
    });
    if (!entry.success) return setStatus({ ok: false, message: "Check the date and the amount." });
    if (!saveTips([...loadTips(), entry.data], examplesForKey)) {
      return setStatus({ ok: false, message: "This browser blocked saving (private mode or storage turned off), so the session wasn't logged." });
    }
    setAmount("");
    setStatus({ ok: true, message: `Logged $${entry.data.amount.toLocaleString("en-AU")} at ${pitch.name}. Plans for this act now take it into account.` });
    // Re-render the plan with the new tip log.
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Log your takings</h2>
        </CardTitle>
        <CardDescription>
          After a session, note what you earned. It stays in this browser (no account). Pitches where you earn more than your average get a
          small bonus in your next plans.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form aria-label="Log your takings" className="grid gap-3 sm:grid-cols-2" onSubmit={submit} noValidate>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${ids}-pitch`}>Pitch</Label>
            <Select value={pitchId} onValueChange={setPitchId}>
              <SelectTrigger id={`${ids}-pitch`} className="w-full">
                <SelectValue placeholder="Choose a pitch" />
              </SelectTrigger>
              <SelectContent>
                {pitches.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${ids}-date`}>Date</Label>
            <Input id={`${ids}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${ids}-amount`}>Takings (A$)</Label>
            <Input id={`${ids}-amount`} type="number" inputMode="decimal" min={0} step="0.05" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 85" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${ids}-from`}>From</Label>
            <Select value={String(startHour)} onValueChange={(v) => setStartHour(Number(v))}>
              <SelectTrigger id={`${ids}-from`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {formatHour(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${ids}-to`}>To</Label>
            <Select value={String(endHour)} onValueChange={(v) => setEndHour(Number(v))}>
              <SelectTrigger id={`${ids}-to`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => h + 1).map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {formatHour(h % 24)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit">Log session</Button>
            <Link className="text-sm underline" href="/tips">
              See your tip log
            </Link>
          </div>
          <p role={status?.ok === false ? "alert" : "status"} className={`text-sm sm:col-span-2 ${status?.ok === false ? "text-destructive" : "text-muted-foreground"}`}>
            {status?.message ?? ""}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
