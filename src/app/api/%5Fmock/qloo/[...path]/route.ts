import { env, qlooMockRouteEnabledOf } from "@/server/env";
import { handleQlooMock } from "@/server/qloo-mock/handler";

/**
 * The local Qloo mock over HTTP, for curl and for pointing another client at
 * it: QLOO_API_BASE_URL=http://localhost:3000/api/_mock/qloo. The app itself
 * calls the mock in-process (src/server/qloo-mock/fetch.ts). Off in
 * production unless QLOO_MOCK_ROUTE=1. The folder is "%5Fmock" because
 * folders starting with "_" are private in the App Router.
 */
const PREFIX = "/api/_mock/qloo";

export async function GET(request: Request) {
  if (!qlooMockRouteEnabledOf(env())) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  url.pathname = url.pathname.slice(PREFIX.length) || "/";
  const response = await handleQlooMock(new Request(url, { headers: request.headers }));
  response.headers.set("x-qloo-mock", "1");
  response.headers.set("cache-control", "no-store");
  return response;
}

const notFound = () => Response.json({ code: 404, reason: "Not Found", message: "No path matching request parameters" }, { status: 404 });
export { notFound as POST, notFound as PUT, notFound as DELETE };
