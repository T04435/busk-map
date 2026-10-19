import "server-only";
import { MODELS, PLANNER_PROVIDER_OPTIONS } from "@/server/agent/models";
import { LEARN_MODEL } from "@/server/playlist/config";

/**
 * The learn run's model (D7): Claude Sonnet 5.5 with medium adaptive thinking, the busk agent's settings (confirmed
 * 17 Oct). Haiku is the one-line switch `LEARN_MODEL` in playlist/config.ts. Haiku's thinking options are unverified on
 * the gateway, so none are sent for it.
 */
export const LEARN_MODEL_ID = LEARN_MODEL === "haiku" ? MODELS.cheap : MODELS.planner;
export const LEARN_PROVIDER_OPTIONS = LEARN_MODEL === "haiku" ? undefined : PLANNER_PROVIDER_OPTIONS;
