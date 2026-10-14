/**
 * Tip log: what a performer earned per pitch and slot. Kept in this browser's
 * localStorage (no account, nothing stored on the server). Plans receive only a
 * summary (takings per hour per pitch): server-rendered pages read it from a
 * first-party cookie this browser writes, and the live agent gets it in the
 * plan request. It is never put in a URL, so shared links don't carry takings.
 * The engine turns it into a small bonus (src/server/scoring/tips.ts).
 */
import { z } from "zod";

export const TIP_STORAGE_KEY = "buskmap.tips.v1";
export const TIP_COOKIE = "buskmap_tips";
/** Cookie budget: the most recent performers, and their busiest pitches. */
export const COOKIE_MAX_PERFORMERS = 6;
export const COOKIE_MAX_PITCHES = 15;
export const MAX_TIP_ENTRIES = 500;
/** Pitches sent with a plan: the ones with the most sessions. */
export const MAX_HISTORY_PITCHES = 40;

const isoDate = z.iso.date();

export const tipEntrySchema = z.object({
  id: z.string().min(1).max(64),
  /** "example:<id>" for an example performer, "act:<name in lower case>" for an own act. */
  performerKey: z.string().min(1).max(100),
  performerName: z.string().min(1).max(80),
  pitchId: z.string().min(1).max(120),
  pitchName: z.string().min(1).max(120),
  date: isoDate,
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  /** Takings in Australian dollars. */
  amount: z.number().min(0).max(100_000),
  /** Seeded example data, never real takings. */
  example: z.boolean().default(false),
});

export type TipEntry = z.infer<typeof tipEntrySchema>;

export const tipHistorySchema = z.object({
  source: z.enum(["example", "yours", "mixed"]),
  sessions: z.number().int().min(0).max(10_000),
  perHour: z.number().min(0).max(100_000),
  pitches: z
    .array(z.object({ id: z.string().min(1).max(120), sessions: z.number().int().min(1).max(10_000), perHour: z.number().min(0).max(100_000) }))
    .max(MAX_HISTORY_PITCHES),
});

export type TipHistory = z.infer<typeof tipHistorySchema>;

export function performerKeyFor(performerName: string, exampleId: string | null): string {
  return exampleId ? `example:${exampleId}` : `act:${performerName.trim().toLowerCase()}`;
}

export const sessionHours = (entry: Pick<TipEntry, "startHour" | "endHour">) => Math.max(0, entry.endHour - entry.startHour);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Summarise one performer's sessions for the engine. Null when there is nothing to summarise. */
export function summarizeTips(entries: TipEntry[]): TipHistory | null {
  const usable = entries.filter((e) => sessionHours(e) > 0);
  if (usable.length === 0) return null;
  const byPitch = new Map<string, { sessions: number; amount: number; hours: number }>();
  let amount = 0;
  let hours = 0;
  for (const entry of usable) {
    const h = sessionHours(entry);
    amount += entry.amount;
    hours += h;
    const pitch = byPitch.get(entry.pitchId) ?? { sessions: 0, amount: 0, hours: 0 };
    pitch.sessions += 1;
    pitch.amount += entry.amount;
    pitch.hours += h;
    byPitch.set(entry.pitchId, pitch);
  }
  const examples = usable.filter((e) => e.example).length;
  return {
    source: examples === usable.length ? "example" : examples === 0 ? "yours" : "mixed",
    sessions: usable.length,
    perHour: round2(amount / hours),
    pitches: [...byPitch.entries()]
      .sort((a, b) => b[1].sessions - a[1].sessions || a[0].localeCompare(b[0]))
      .slice(0, MAX_HISTORY_PITCHES)
      .map(([id, p]) => ({ id, sessions: p.sessions, perHour: round2(p.amount / p.hours) })),
  };
}

const SOURCE_CODE = { example: "e", yours: "y", mixed: "m" } as const;
const CODE_SOURCE = { e: "example", y: "yours", m: "mixed" } as const;

/** URL form: `<e|y|m>~<sessions>~<perHour>|<pitchId>~<sessions>~<perHour>|…` */
export function tipsParam(history: TipHistory | null | undefined): string | null {
  if (!history) return null;
  return [`${SOURCE_CODE[history.source]}~${history.sessions}~${history.perHour}`, ...history.pitches.map((p) => `${p.id}~${p.sessions}~${p.perHour}`)].join("|");
}

/** Parse the `tips` URL parameter. Anything malformed is ignored (the plan then has no personal bonus). */
export function parseTipsParam(value: string | undefined | null): TipHistory | undefined {
  if (!value) return undefined;
  const [head, ...rest] = value.split("|");
  const [code, sessions, perHour] = head.split("~");
  const source = CODE_SOURCE[code as keyof typeof CODE_SOURCE];
  const parsed = tipHistorySchema.safeParse({
    source,
    sessions: Number(sessions),
    perHour: Number(perHour),
    pitches: rest.map((entry) => {
      const parts = entry.split("~");
      return { id: parts.slice(0, -2).join("~"), sessions: Number(parts.at(-2)), perHour: Number(parts.at(-1)) };
    }),
  });
  return parsed.success ? parsed.data : undefined;
}

/** Cookie value: {performerKey: tipsParam} as URI-encoded JSON. */
export function encodeTipCookie(byPerformer: Record<string, TipHistory>): string {
  const compact = Object.fromEntries(
    Object.entries(byPerformer)
      .slice(-COOKIE_MAX_PERFORMERS)
      .map(([key, history]) => [key, tipsParam({ ...history, pitches: history.pitches.slice(0, COOKIE_MAX_PITCHES) })]),
  );
  return encodeURIComponent(JSON.stringify(compact));
}

/** The history for one performer from the tip cookie; undefined when absent or malformed. */
export function historyFromCookie(cookie: string | null | undefined, performerKey: string): TipHistory | undefined {
  if (!cookie) return undefined;
  try {
    const data: unknown = JSON.parse(decodeURIComponent(cookie));
    if (!data || typeof data !== "object") return undefined;
    const value = (data as Record<string, unknown>)[performerKey];
    return typeof value === "string" ? parseTipsParam(value) : undefined;
  } catch {
    return undefined;
  }
}

// ---- Browser storage (wrapped: private windows and blocked storage throw) ----

export function loadTips(): TipEntry[] {
  try {
    const raw = window.localStorage.getItem(TIP_STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.flatMap((item) => {
      const entry = tipEntrySchema.safeParse(item);
      // Example data is never stored: it lives in the code.
      return entry.success && !entry.data.example ? [entry.data] : [];
    });
  } catch {
    return [];
  }
}

/**
 * Summaries per performer for the cookie: the performer's own sessions, plus
 * the example sessions for an example performer (`examplesFor`).
 */
export function summariesByPerformer(entries: TipEntry[], examplesFor: (performerKey: string) => TipEntry[]): Record<string, TipHistory> {
  const keys: string[] = [];
  for (const entry of entries) {
    const at = keys.indexOf(entry.performerKey);
    if (at >= 0) keys.splice(at, 1);
    keys.push(entry.performerKey); // most recently logged last
  }
  const out: Record<string, TipHistory> = {};
  for (const key of keys) {
    const history = summarizeTips([...examplesFor(key), ...entries.filter((e) => e.performerKey === key)]);
    if (history) out[key] = history;
  }
  return out;
}

/** Write (or clear) the tip cookie the server reads when it renders a plan. */
export function writeTipCookie(byPerformer: Record<string, TipHistory>): void {
  try {
    const empty = Object.keys(byPerformer).length === 0;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${TIP_COOKIE}=${empty ? "" : encodeTipCookie(byPerformer)}; Path=/; SameSite=Lax; Max-Age=${empty ? 0 : 31_536_000}${secure}`;
  } catch {
    // Cookies blocked: plans just don't get the personal bonus.
  }
}

/** Save the log; false when the browser refused (the caller says so). */
export function saveTips(entries: TipEntry[], examplesFor: (performerKey: string) => TipEntry[]): boolean {
  try {
    const own = entries.filter((e) => !e.example).slice(-MAX_TIP_ENTRIES);
    window.localStorage.setItem(TIP_STORAGE_KEY, JSON.stringify(own));
    writeTipCookie(summariesByPerformer(own, examplesFor));
    window.dispatchEvent(new Event("buskmap:tips"));
    return true;
  } catch {
    return false;
  }
}

export function newTipId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** The history a plan should use for this performer, as the cookie would carry it. */
export function expectedHistory(entries: TipEntry[], performerKey: string, examplesFor: (performerKey: string) => TipEntry[]): TipHistory | undefined {
  const history = summarizeTips([...examplesFor(performerKey), ...entries.filter((e) => e.performerKey === performerKey && !e.example)]);
  return history ? { ...history, pitches: history.pitches.slice(0, COOKIE_MAX_PITCHES) } : undefined;
}

/** Comparable form of a history (for "is the rendered plan up to date with the log?"). */
export const historyKey = (history: TipHistory | null | undefined) => tipsParam(history) ?? "";
