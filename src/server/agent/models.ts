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

/** Cost and runaway limits. The gateway's US$50/month budget is the backstop. */
export const LIMITS = {
  /** Tool steps plus the final structured-output step. */
  maxSteps: 8,
  maxOutputTokensPerStep: 1200,
  agentTimeoutMs: 75_000,
  compareMaxOutputTokens: 1600,
  compareTimeoutMs: 30_000,
} as const;
