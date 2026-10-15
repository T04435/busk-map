import "server-only";

/**
 * Model ids on Vercel AI Gateway, checked against the gateway's model list on
 * 2026-10-15 (GET https://ai-gateway.vercel.sh/v1/models):
 * - planner: the latest Claude Sonnet, for the agent loop and explanations
 * - cheap: the latest Claude Haiku, for the plain-LLM comparison
 */
export const MODELS = {
  planner: "anthropic/claude-sonnet-5.5",
  cheap: "anthropic/claude-haiku-5.5",
} as const;

/**
 * Claude's thinking for the planner. Claude Sonnet 5.5 takes adaptive
 * thinking only (a fixed `budgetTokens` is rejected), so "a modest budget"
 * is effort "medium". `display: "summarized"` returns readable reasoning
 * summaries; the default ("omitted") would stream empty thinking blocks.
 * The gateway forwards these to Anthropic.
 */
export const PLANNER_PROVIDER_OPTIONS = {
  anthropic: { thinking: { type: "adaptive", display: "summarized" }, effort: "medium" },
} as const;

/** Cost and runaway limits. The gateway's US$50/month budget is the backstop. */
export const LIMITS = {
  /** Model steps (each may call several tools), including the finish_plan step. */
  maxSteps: 12,
  /** Input plus output tokens over the whole run; past 75% only finish_plan is offered. */
  tokenBudget: 200_000,
  /** Per step, thinking included. */
  maxOutputTokensPerStep: 4000,
  agentTimeoutMs: 90_000,
  compareMaxOutputTokens: 1600,
  compareTimeoutMs: 30_000,
} as const;
