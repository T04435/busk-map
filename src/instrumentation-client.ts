import { initBotId } from "botid/client/core";
import { BOTID_PROTECTED_ROUTES } from "@/lib/botid-routes";

// BotID only runs on Vercel deployments (set at build time in next.config.ts).
// Locally, in `next start` and in the e2e tests there is nothing to verify against,
// so the browser sends no challenge and the server skips the check.
if (process.env.NEXT_PUBLIC_BUSKMAP_BOTID === "1") {
  try {
    initBotId({ protect: BOTID_PROTECTED_ROUTES.map((r) => ({ ...r })) });
  } catch {
    // Never break the app over bot protection: the server rejects unverified calls.
  }
}
