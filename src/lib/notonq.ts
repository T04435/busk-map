/**
 * NotOnQ (https://notonq.vercel.app): a drop-in proxy for Qloo's API that fills in music artists Qloo lacks, in Qloo's own shape,
 * and answers taste questions for them through stand-ins (similar artists Qloo knows). Busk Map sends its Qloo calls through it
 * when QLOO_PROXY_BASE_URL is set (adapters/qloo/client.ts), with Qloo direct as the fallback.
 *
 * Client-safe: the provenance types every layer carries, from the Qloo client to stored research and plans, and the labels the
 * UI shows. What NotOnQ filled is always labelled; nothing Qloo returned is relabelled. A missing field (older stored rows, every
 * answer Qloo gave alone) means "not NotOnQ".
 */

/** Who filled an artist in: NotOnQ, or nobody (Qloo's own entity). Optional where stored: missing is null. */
export type FilledBy = "notonq" | null;

/**
 * An answer NotOnQ gave in place of Qloo's for an artist: Qloo's answer for similar artists Qloo knows (stand-ins), or for the
 * artist's own Qloo genres when Qloo has no audience data for it (gap G5). `genres` holds readable genre names; absent when none.
 */
export type NotOnQVia = { by: "notonq"; standIns: string[]; genres?: string[] };

/** The label on anything NotOnQ filled in (an act, a sound-alike, a crowd artist). */
export const FILLED_BY_NOTONQ = "Filled by NotOnQ";

/** The label on a result Qloo answered for NotOnQ's genres or stand-ins. Genres come first: they are what Qloo was asked about. */
export function viaLabel(via: Pick<NotOnQVia, "standIns" | "genres">): string {
  if (via.genres?.length) return `Via NotOnQ genres: ${via.genres.join(", ")}`;
  return via.standIns.length > 0 ? `Via NotOnQ stand-ins: ${via.standIns.join(", ")}` : "Via NotOnQ stand-ins";
}

/** A genre's readable name from its Qloo tag ID: `urn:tag:genre:music:indie_folk` is "indie folk". */
export function genreName(tagId: string): string {
  return (tagId.split(":").pop() ?? tagId).replace(/_/g, " ").trim();
}

/** NotOnQ starts every short description of an artist it filled (or offers as a candidate) with these words. */
export const NOT_IN_QLOO = /^\s*Not in Qloo\b/i;
/** NotOnQ's own tags (a genre Qloo has no tag for) carry this prefix. */
export const NOTONQ_TAG_PREFIX = "notonq:";

/** Whether an entity was filled in by NotOnQ: its short description says "Not in Qloo", or it carries NotOnQ's own tags. */
export function isNotOnQFilled(entity: { shortDescription?: string | null; tagIds?: readonly string[] }): boolean {
  return Boolean(entity.shortDescription && NOT_IN_QLOO.test(entity.shortDescription)) || (entity.tagIds ?? []).some((id) => id.startsWith(NOTONQ_TAG_PREFIX));
}

/**
 * Whether an artist NotOnQ filled in has no stand-ins: it found no similar artists Qloo knows (`notonq:standIns` absent or empty),
 * so it can't answer taste questions about the artist. Such a fill is the act's name only, not a Qloo taste signal.
 */
export function hasNoStandIns(properties: Record<string, unknown> | undefined): boolean {
  const list = properties?.["notonq:standIns"];
  return !Array.isArray(list) || list.length === 0;
}

/** The `{ noStandIns }` field to spread into an entity: present only for a NotOnQ fill with no stand-ins. */
export const noStandInsMark = (filledBy: FilledBy, properties: Record<string, unknown> | undefined): { noStandIns?: true } =>
  filledBy === "notonq" && hasNoStandIns(properties) ? { noStandIns: true } : {};

/** Several stand-in answers as one: the stand-ins of all of them, once each, in order. Null when there are none. */
export function mergeVia(list: readonly (NotOnQVia | null | undefined)[]): NotOnQVia | null {
  const given = list.filter((v): v is NotOnQVia => Boolean(v));
  if (given.length === 0) return null;
  const genres = [...new Set(given.flatMap((v) => v.genres ?? []))];
  return { by: "notonq", standIns: [...new Set(given.flatMap((v) => v.standIns))], ...(genres.length ? { genres } : {}) };
}

/** The `{ filledBy }` field to spread into a stored row: present only when NotOnQ filled it, so rows Qloo answered keep their shape. */
export const filledMark = (filledBy: FilledBy | undefined): { filledBy?: "notonq" } => (filledBy === "notonq" ? { filledBy } : {});

/** The `{ via }` field to spread into a stored step or result: present only for an answer given through NotOnQ's stand-ins. */
export const viaMark = (via: NotOnQVia | null | undefined): { via?: NotOnQVia } => (via ? { via: { by: "notonq", standIns: [...via.standIns], ...(via.genres?.length ? { genres: [...via.genres] } : {}) } } : {});
