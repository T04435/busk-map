import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
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
      { path: "/api/playlist/learn", method: "POST" },
      { path: "/api/playlist/research", method: "POST" },
      { path: "/api/playlist/research/*/input", method: "POST" },
      { path: "/api/playlist/learn/suggestions/*", method: "PATCH" },
      { path: "/api/playlist/profile", method: "POST" },
    ]);
  });

  it("lists every route handler that calls guardMutation or rejectBots, and nothing else (T01)", async () => {
    const { BOTID_PROTECTED_ROUTES } = await import("@/lib/botid-routes");
    const root = join(process.cwd(), "src/app/api");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "route.ts") files.push(full);
      }
    };
    walk(root);
    const guarded: string[] = [];
    for (const file of files) {
      const route = "/api/" + relative(root, dirname(file)).split(sep).filter(Boolean).map((seg) => (seg.startsWith("[") ? "*" : seg)).join("/");
      const source = readFileSync(file, "utf8");
      // One chunk per exported handler: its body runs to the next export.
      for (const chunk of source.split(/^export (?=async function|function|const)/m).slice(1)) {
        const method = /^(?:async )?function (GET|POST|PATCH|PUT|DELETE)\b|^const (GET|POST|PATCH|PUT|DELETE)\b/.exec(chunk);
        if (method && /\b(guardMutation|rejectBots)\(/.test(chunk)) guarded.push(`${method[1] ?? method[2]} ${route}`.replace(/\/$/, ""));
      }
    }
    const listed = BOTID_PROTECTED_ROUTES.map((r) => `${r.method} ${r.path}`);
    expect(guarded.length).toBeGreaterThan(10);
    expect([...guarded].sort()).toEqual([...listed].sort());
  });
});
