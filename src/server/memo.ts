import "server-only";

/**
 * A Map shared by the whole server process. Next bundles a page and a route
 * handler separately, so a module-level Map in a shared module exists once
 * per bundle; the plan page and /api/compare (or /api/plan) must see the same
 * memo, so it lives on globalThis.
 */
export function processMap<K, V>(name: string): Map<K, V> {
  const key = Symbol.for(`buskmap:${name}`);
  const store = globalThis as unknown as Record<symbol, Map<K, V> | undefined>;
  return (store[key] ??= new Map<K, V>());
}
