import { handleQlooMock } from "./handler";

/** Origin the Qloo client uses in mock mode. Never resolved on the network. */
export const QLOO_MOCK_BASE_URL = "https://qloo-mock.invalid";

/**
 * A `fetch` that answers Qloo requests in-process from the mock, so the real
 * client runs unchanged: same URL building, headers, status handling and
 * response validation as against https://hackathon.api.qloo.com.
 */
export async function qlooMockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init);
  return handleQlooMock(request);
}
