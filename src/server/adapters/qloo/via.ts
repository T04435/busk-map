import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { mergeVia, type NotOnQVia } from "@/lib/notonq";
import type { NotOnQBlock } from "./schema";

/**
 * Answers NotOnQ gave through stand-ins (lib/notonq.ts), carried from a cached Qloo lookup to the AdapterResult that shows it.
 *
 * A cached lookup's value is the domain value Qloo's answer was trimmed to (cells, a profile, artists). When NotOnQ answered it
 * for stand-ins, the cached value is that domain value wrapped with the stand-ins (`tagVia`), so a cache hit says so as well as
 * the request that filled it. The lookup's wrapper unwraps it (`untagVia`) and notes the stand-ins in the caller's scope;
 * index.ts collects them per adapter call (`collectVia`) onto the result's `via`. A value cached before this existed, or any
 * answer Qloo gave alone, is the plain domain value: no `via`.
 */

/** The wrapper key: unlikely in any Qloo-derived value. */
const KEY = "__notonqVia";
type Tagged<T> = { [KEY]: NotOnQVia; value: T };
export type MaybeVia<T> = T | Tagged<T>;

/** Whether NotOnQ's block says the answer was given for stand-ins (served_by mixed or fallback, with stand-ins or a G2 gap). */
export function viaOf(block: NotOnQBlock | undefined): NotOnQVia | null {
  if (!block || (block.servedBy !== "mixed" && block.servedBy !== "fallback")) return null;
  if (block.standIns.length === 0 && block.gapKind !== "G2") return null;
  return { by: "notonq", standIns: block.standIns };
}

/** A cache body's value, wrapped with NotOnQ's stand-ins when it answered for them (otherwise the value as it is). */
export function tagVia<T>(value: T, block: NotOnQBlock | undefined): MaybeVia<T> {
  const via = viaOf(block);
  return via ? { [KEY]: via, value } : value;
}

function isTagged<T>(value: MaybeVia<T>): value is Tagged<T> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && KEY in (value as object);
}

function processSingleton<T>(name: string, make: () => T): T {
  const key = Symbol.for(`buskmap:${name}`);
  const store = globalThis as unknown as Record<symbol, T | undefined>;
  return (store[key] ??= make());
}

const scope = processSingleton("qloo-notonq-via", () => new AsyncLocalStorage<NotOnQVia[]>());

/** The value of a cached lookup, unwrapped; NotOnQ's stand-ins, when there were some, are noted in the caller's scope. */
export function untagVia<T>(value: MaybeVia<T>): T {
  if (!isTagged(value)) return value;
  scope.getStore()?.push(value[KEY]);
  return value.value;
}

/**
 * Run `fn` and collect the stand-ins any lookup inside it was answered through (null: none). Scopes nest: what an inner scope
 * collected (one adapter call) is also noted in the enclosing one (the research step that made it).
 */
export async function collectVia<T>(fn: () => Promise<T>): Promise<{ value: T; via: NotOnQVia | null }> {
  const parent = scope.getStore();
  const list: NotOnQVia[] = [];
  const value = await scope.run(list, fn);
  const via = mergeVia(list);
  if (via) parent?.push(via);
  return { value, via };
}
