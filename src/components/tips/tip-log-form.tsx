"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { DatePicker } from "@/components/forms/date-picker";
import { FormMessage } from "@/components/honeycomb/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { examplesForKey } from "@/lib/example-tips";
import { loadRecentPlans, RECENT_PLANS_KEY } from "@/lib/recent-plans";
import { formatHour } from "@/lib/slot";
import { loadTips, newTipId, performerKeyFor, saveTips, tipEntrySchema } from "@/lib/tips";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const TYPED = "typed";

/** Today in the browser's time zone, as YYYY-MM-DD. */
const todayHere = () => new Date().toLocaleDateString("en-CA");
const noSubscribe = () => () => {};
const money = (n: number) => `A$${n.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

const subscribeRecent = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener("buskmap:recent-plans", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("buskmap:recent-plans", onChange);
  };
};
const SERVER = "\u0000server";
const recentSnapshot = () => {
  try {
    return window.localStorage.getItem(RECENT_PLANS_KEY) ?? "";
  } catch {
    return "";
  }
};

type Status = { ok: boolean; message: string } | null;

/**
 * "Log your takings": which pitch you played (one scored in a recent plan from this browser, or typed), the date, from and
 * to, and what you earned. Saved in this browser only. A pitch from a plan carries the id the plans score by, so the
 * takings adjust your next plans; a typed pitch is kept in the log and listed, but no plan can match it.
 */
export function TipLogForm() {
  const ids = useId();
  const rawRecent = useSyncExternalStore(subscribeRecent, recentSnapshot, () => SERVER);
  const recents = useMemo(() => (rawRecent === SERVER ? [] : loadRecentPlans()), [rawRecent]);
  const today = useSyncExternalStore(noSubscribe, todayHere, () => null);

  // `null` means "not chosen yet": the first recent plan, or a typed pitch when there is none.
  const [chosenPlan, setChosenPlan] = useState<string | null>(null);
  const planKey = chosenPlan && (chosenPlan === TYPED || recents.some((p) => p.key === chosenPlan)) ? chosenPlan : (recents[0]?.key ?? TYPED);
  const plan = recents.find((p) => p.key === planKey) ?? null;
  const [chosenPitch, setChosenPitch] = useState<string | null>(null);
  const pitchId = plan ? (plan.pitches.some((p) => p.id === chosenPitch) ? chosenPitch! : plan.pitches[0].id) : "";
  const [actName, setActName] = useState("");
  const [pitchName, setPitchName] = useState("");
  const [override, setOverride] = useState<{ plan: string; date?: string; start?: number; end?: number }>({ plan: "" });
  const ov = override.plan === planKey ? override : { plan: planKey };
  // Takings are logged after playing: a plan for a later day defaults to today.
  const date = ov.date ?? (plan ? (today && plan.date > today ? today : plan.date) : (today ?? ""));
  const startHour = ov.start ?? plan?.startHour ?? 12;
  const endHour = ov.end ?? plan?.endHour ?? 15;
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>(null);

  const set = (patch: { date?: string; start?: number; end?: number }) => setOverride({ ...ov, ...patch, plan: planKey });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    const performerName = plan ? plan.performerName : actName.trim();
    const pitch = plan ? plan.pitches.find((p) => p.id === pitchId) : pitchName.trim() ? { id: `typed:${slug(pitchName) || "pitch"}`, name: pitchName.trim() } : null;
    if (!plan && !performerName) return setStatus({ ok: false, message: "Act name: enter the act you played as." });
    if (!pitch) return setStatus({ ok: false, message: plan ? "Pitch: choose the pitch you played." : "Pitch: enter the name of the pitch you played." });
    if (amount.trim() === "" || !Number.isFinite(value) || value < 0) return setStatus({ ok: false, message: "Takings: enter what you earned, in dollars (0 or more)." });
    if (endHour <= startHour) return setStatus({ ok: false, message: "To: the session must end after it starts." });
    if (date > (today ?? todayHere())) return setStatus({ ok: false, message: "Date: that date is in the future. Log a session after you've played it." });
    const entry = tipEntrySchema.safeParse({
      id: newTipId(),
      performerKey: performerKeyFor(performerName, plan?.exampleId ?? null),
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
    setStatus({
      ok: true,
      message: plan
        ? `Logged ${money(entry.data.amount)} at ${pitch.name}. Plans for ${performerName} now take it into account.`
        : `Logged ${money(entry.data.amount)} at ${pitch.name}. It is in your log below; plans can only use takings from a pitch they scored.`,
    });
  }

  return (
    <section id="log-takings" aria-labelledby="log-h" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="log-h">Log your takings</h2>
          </CardTitle>
          <CardDescription>
            After you play, note what you earned. Pitches where you earn more than your average get a small bonus in your next plans. Saved in this browser only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form aria-label="Log your takings" className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
            {recents.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`${ids}-plan`}>Busk</Label>
                <Select value={planKey} onValueChange={(v) => { setChosenPlan(v); setChosenPitch(null); setStatus(null); }}>
                  <SelectTrigger id={`${ids}-plan`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Recent plans in this browser</SelectLabel>
                      {recents.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.performerName} · {p.date}, {formatHour(p.startHour)}–{formatHour(p.endHour)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectItem value={TYPED}>Another pitch: type its name</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
            {plan ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`${ids}-pitch`}>Pitch</Label>
                <Select value={pitchId} onValueChange={setChosenPitch}>
                  <SelectTrigger id={`${ids}-pitch`} className="w-full">
                    <SelectValue placeholder="Choose a pitch" />
                  </SelectTrigger>
                  <SelectContent>
                    {plan.pitches.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor={`${ids}-act`}>Act name</Label>
                  <Input id={`${ids}-act`} value={actName} onChange={(e) => setActName(e.target.value)} maxLength={80} placeholder="e.g. Jess on acoustic guitar" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${ids}-pitch`}>Pitch</Label>
                  <Input id={`${ids}-pitch`} value={pitchName} onChange={(e) => setPitchName(e.target.value)} maxLength={120} placeholder="e.g. Hardware Lane" autoComplete="off" aria-describedby={`${ids}-typed`} />
                </div>
                <FormMessage id={`${ids}-typed`} className="sm:col-span-2">
                  {recents.length === 0
                    ? "Plan a busk first and its pitches show up here, so your takings can adjust your next plans. A pitch typed here is kept in your log, but no plan can match it."
                    : "A pitch typed here is kept in your log, but no plan can match it. Pick one from a recent plan for the bonus."}
                </FormMessage>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-date`}>Date</Label>
              <DatePicker id={`${ids}-date`} value={date} onChange={(v) => set({ date: v })} max={today} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-amount`}>Takings</Label>
              <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-base font-bold text-muted-foreground">
                  A$
                </span>
                <Input
                  id={`${ids}-amount`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="85"
                  className="pl-11 font-mono tabular-nums"
                  aria-invalid={status?.ok === false && status.message.startsWith("Takings") ? true : undefined}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-from`}>From</Label>
              <Select value={String(startHour)} onValueChange={(v) => set({ start: Number(v) })}>
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
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-to`}>To</Label>
              <Select value={String(endHour)} onValueChange={(v) => set({ end: Number(v) })}>
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
            <div className="flex flex-col gap-3 sm:col-span-2">
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 max-sm:[&>button]:w-full">
                <Button type="submit" size="lg">
                  Log takings
                </Button>
                <span className="text-sm text-muted-foreground">Saved in this browser only.</span>
              </div>
              {status ? <FormMessage tone={status.ok ? "success" : "error"}>{status.message}</FormMessage> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
