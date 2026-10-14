/**
 * Personal results: a small bonus for pitches where this performer has
 * earned more than their own average. Pure: the history is a summary the
 * browser computes from its tip log (no account, nothing stored on the server).
 *
 * bonus = TIP_BONUS_MAX × strength × confidence, where
 * - strength   = min(1, lift / TIP_FULL_LIFT), lift = (earned per hour here ÷ average per hour) − 1
 * - confidence = min(1, sessions here ÷ TIP_FULL_SESSIONS)
 * A pitch where they earned less gets no bonus: personal results never push a
 * pitch down, they only nudge the ones that worked.
 */

/** At most +5 points out of 100. */
export const TIP_BONUS_MAX = 0.05;
/** Earning 50% more per hour than your average earns the full bonus. */
export const TIP_FULL_LIFT = 0.5;
/** Three sessions at a pitch earn full confidence. */
export const TIP_FULL_SESSIONS = 3;
/** With fewer logged sessions than this there is no average to compare with. */
export const TIP_MIN_SESSIONS = 2;

export type TipHistory = {
  /** Where the sessions come from: the example data, the performer's own log, or both. */
  source: "example" | "yours" | "mixed";
  /** All logged sessions for this performer. */
  sessions: number;
  /** Takings per hour across all sessions. */
  perHour: number;
  pitches: { id: string; sessions: number; perHour: number }[];
};

export type TipBonus = {
  /** 0 to TIP_BONUS_MAX. */
  bonus: number;
  sessions: number;
  perHour: number;
  averagePerHour: number;
  /** perHour ÷ averagePerHour − 1; negative when the pitch earned less. */
  lift: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The bonus for one pitch, or null when the history says nothing about it. */
export function tipBonus(pitchId: string, history: TipHistory | null | undefined): TipBonus | null {
  if (!history || history.sessions < TIP_MIN_SESSIONS || history.perHour <= 0) return null;
  const pitch = history.pitches.find((p) => p.id === pitchId);
  if (!pitch || pitch.sessions <= 0) return null;
  const lift = pitch.perHour / history.perHour - 1;
  const strength = Math.min(1, Math.max(0, lift) / TIP_FULL_LIFT);
  const confidence = Math.min(1, pitch.sessions / TIP_FULL_SESSIONS);
  return {
    bonus: Math.round(TIP_BONUS_MAX * strength * confidence * 1e4) / 1e4,
    sessions: pitch.sessions,
    perHour: round2(pitch.perHour),
    averagePerHour: round2(history.perHour),
    lift: round2(lift),
  };
}
