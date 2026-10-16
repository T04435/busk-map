import { beforeEach, describe, expect, it, vi } from "vitest";

const checkBotId = vi.fn();
vi.mock("botid/server", () => ({ checkBotId: (...args: unknown[]) => checkBotId(...args) }));

describe("rejectBots", () => {
  beforeEach(() => checkBotId.mockReset());

  it("skips the check off Vercel (local dev, next start, e2e)", async () => {
    vi.stubEnv("VERCEL", "");
    const { rejectBots } = await import("@/server/bot");
    expect(await rejectBots("/api/plan")).toBeNull();
    expect(checkBotId).not.toHaveBeenCalled();
  });

  it("lets humans through and rejects bots on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    const { rejectBots } = await import("@/server/bot");
    checkBotId.mockResolvedValueOnce({ isBot: false, isHuman: true });
    expect(await rejectBots("/api/plan")).toBeNull();
    checkBotId.mockResolvedValueOnce({ isBot: true, isHuman: false });
    const blocked = await rejectBots("/api/plan");
    expect(blocked?.status).toBe(403);
    expect((await blocked!.json()).error.code).toBe("bot_detected");
  });

  it("fails closed when BotID itself fails", async () => {
    vi.stubEnv("VERCEL", "1");
    const { rejectBots } = await import("@/server/bot");
    checkBotId.mockRejectedValueOnce(new Error("VERCEL_OIDC_TOKEN is not set"));
    expect((await rejectBots("/api/week"))?.status).toBe(503);
  });

  it("protects the expensive routes and plan-link creation, with the methods the app uses", async () => {
    const { BOTID_PROTECTED_ROUTES } = await import("@/lib/botid-routes");
    expect(BOTID_PROTECTED_ROUTES).toEqual([
      { path: "/api/plan", method: "POST" },
      { path: "/api/plans", method: "POST" },
      { path: "/api/compare", method: "POST" },
      { path: "/api/week", method: "POST" },
      { path: "/api/repertoire", method: "GET" },
      { path: "/api/playlist", method: "POST" },
      { path: "/api/playlist", method: "PATCH" },
      { path: "/api/playlist", method: "DELETE" },
      { path: "/api/playlist/songs", method: "POST" },
      { path: "/api/playlist/songs/*", method: "PATCH" },
      { path: "/api/playlist/songs/*", method: "DELETE" },
      { path: "/api/playlist/learn/suggestions", method: "POST" },
    ]);
  });
});
