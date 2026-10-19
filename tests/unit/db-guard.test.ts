import { describe, expect, it } from "vitest";
import { mainGuard } from "../../scripts/db-guard.mjs";

const MAIN = "postgresql://u:p@ep-lingering-fog-a77eaxtl.ap-southeast-2.aws.neon.tech/db";
const MAIN_POOLED = "postgresql://u:p@ep-lingering-fog-a77eaxtl-pooler.ap-southeast-2.aws.neon.tech/db";
const DEV = "postgresql://u:p@ep-long-fog-a7x2ifwi.ap-southeast-2.aws.neon.tech/db";

describe("main database guard (scripts/db-guard.mjs)", () => {
  it("refuses the main endpoint outside the Vercel production build, naming the endpoint and never the URL", () => {
    for (const env of [{ DATABASE_URL_UNPOOLED: MAIN }, { DATABASE_URL: MAIN_POOLED }, { DATABASE_URL_UNPOOLED: MAIN, VERCEL_ENV: "preview", VERCEL: "1" }, { DATABASE_URL_UNPOOLED: MAIN, VERCEL_ENV: "production" }]) {
      const verdict = mainGuard(env);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toContain("ep-lingering-fog-a77eaxtl");
      expect(verdict.reason).not.toContain("postgresql://");
      expect(verdict.reason).not.toContain("u:p@");
    }
  });

  it("allows the dev branch, and main only in the Vercel production build", () => {
    expect(mainGuard({ DATABASE_URL_UNPOOLED: DEV, DATABASE_URL: DEV }).ok).toBe(true);
    expect(mainGuard({ DATABASE_URL_UNPOOLED: MAIN, VERCEL_ENV: "production", VERCEL: "1" }).ok).toBe(true);
    expect(mainGuard({}).ok).toBe(true);
  });

  it("checks every database variable, not only the first", () => {
    expect(mainGuard({ DATABASE_URL_UNPOOLED: DEV, DATABASE_URL: MAIN_POOLED }).ok).toBe(false);
  });
});
