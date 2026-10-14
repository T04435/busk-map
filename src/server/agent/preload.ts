import "server-only";
import type { PlanRequest } from "@/lib/plan-schema";
import type { AdapterContext } from "@/server/adapters/core";
import { assemblePlan } from "./assemble";
import { PlanContext } from "./context";

/**
 * The engine's plan without the model: instant, free, and shown first. The
 * live agent (POST /api/plan) then adds Claude's explanations.
 */
export async function buildEnginePlan(request: PlanRequest, adapters: AdapterContext) {
  const context = new PlanContext(request, adapters);
  await context.artists();
  return assemblePlan(context, null);
}
