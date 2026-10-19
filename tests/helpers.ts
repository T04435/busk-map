import { vi } from "vitest";

type Route = {
  match: (url: URL, init?: RequestInit) => boolean;
  respond: (url: URL, init?: RequestInit) => Response | Promise<Response>;
};

export type FetchCall = { url: URL; init?: RequestInit };

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function timeoutError(): Error {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

/** Stub global fetch with URL-matched routes. Unmatched requests fail the test loudly. */
export function mockFetch(routes: Route[]) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push({ url, init });
    const route = routes.find((r) => r.match(url, init));
    if (!route) throw new Error(`Unexpected fetch in test: ${url.host}${url.pathname}`);
    return route.respond(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

export const route = (
  match: (url: URL, init?: RequestInit) => boolean,
  respond: Route["respond"],
): Route => ({ match, respond });

export const OFFLINE = { offline: true, faults: [] } as const;
export const LIVE = { offline: false, faults: [] } as const;
