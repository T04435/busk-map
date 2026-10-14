import { vi } from "vitest";

// Next's cache APIs only work inside a Next.js server. Unit tests call the
// adapters directly, so the directives are inert and these become no-ops.
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
