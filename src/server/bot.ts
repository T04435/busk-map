import "server-only";
import { checkBotId } from "botid/server";
import { log } from "@/server/log";

/** BotID can only verify on Vercel; locally (dev, `next start`, e2e) the check is skipped. */
export const botIdEnforced = () => Boolean(process.env.VERCEL);

/**
 * Reject bots on a protected route (see lib/botid-routes.ts). Returns a
 * response to send instead, or null to carry on. If BotID itself fails, the
 * route fails closed: these endpoints spend the AI budget or a rate-limited quota.
 */
export async function rejectBots(route: string): Promise<Response | null> {
  if (!botIdEnforced()) return null;
  try {
    const verification = await checkBotId();
    if (!verification.isBot) return null;
    log.info("bot rejected", { route });
    return Response.json({ error: { code: "bot_detected", message: "This request looked automated. Reload the page and try again." } }, { status: 403 });
  } catch (error) {
    log.error("bot check failed", { route, error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: { code: "bot_check_unavailable", message: "We couldn't verify this request. Reload the page and try again." } }, { status: 503 });
  }
}
