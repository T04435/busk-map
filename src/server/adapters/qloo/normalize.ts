import type { z } from "zod";
import { entitySchema, type EntityDetail, type explainabilityAggregateSchema, type Explanation, type Impact, type QlooEntity, type QlooPlace, type RawEntity } from "./schema";

/**
 * Pull "which input entity drove this result" out of a result's
 * `query.explainability`. Live shape (verified 2026-10-15):
 * `{"signal.interests.entities": [{entity_id, score}]}`. Kept tolerant: any
 * list of objects with an entity id and a 0–1 score, at any depth.
 */
export function extractExplanations(value: unknown, depth = 0): Explanation[] {
  if (depth > 4 || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => extractExplanations(item, depth + 1));
  const record = value as Record<string, unknown>;
  const id = record.entity_id ?? record.id;
  const score = record.score ?? record.affinity ?? record.weight;
  if (typeof id === "string" && typeof score === "number" && Number.isFinite(score)) {
    return [{ entityId: id, name: typeof record.name === "string" ? record.name : null, score }];
  }
  return Object.values(record).flatMap((child) => extractExplanations(child, depth + 1));
}

export function toEntity(raw: RawEntity): QlooEntity {
  const explanation = extractExplanations(raw.query?.explainability).sort((a, b) => b.score - a.score);
  return {
    id: raw.entity_id,
    name: raw.name,
    popularity: raw.popularity ?? null,
    lastfmListeners: raw.properties?.external?.lastfm?.listeners ?? raw.external?.lastfm?.find((l) => l.listeners !== undefined)?.listeners ?? null,
    affinity: raw.query?.affinity ?? null,
    audienceGrowth: raw.query?.measurements?.audience_growth ?? null,
    spotifyId: raw.properties?.external?.spotify?.id ?? raw.external?.spotify?.find((s) => s.id)?.id ?? null,
    image: raw.properties?.image?.url || null,
    tags: (raw.tags ?? []).flatMap((t) => (t.id ? [{ id: t.id, name: t.name || t.id }] : [])),
    explanation,
  };
}

/** A text field that may be a string or `{ value }` (Qloo sends both shapes for descriptions). */
function textOf(value: unknown): string | null {
  const v = typeof value === "string" ? value : value && typeof value === "object" && typeof (value as { value?: unknown }).value === "string" ? (value as { value: string }).value : null;
  const t = v?.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 600) : null;
}

export function toDetail(raw: RawEntity): EntityDetail {
  const props = (raw.properties ?? {}) as Record<string, unknown>;
  return {
    id: raw.entity_id,
    name: raw.name,
    popularity: raw.popularity ?? null,
    description: textOf(props.description) ?? textOf(props.short_description),
    tags: (raw.tags ?? []).flatMap((t) => (t.id ? [{ id: t.id, name: (t.name || t.id).trim(), type: t.type ?? null }] : [])),
  };
}

export function toPlace(raw: RawEntity): QlooPlace | null {
  const lat = raw.location?.lat ?? raw.location?.latitude ?? raw.properties?.geocode?.latitude;
  const lon = raw.location?.lon ?? raw.location?.longitude ?? raw.properties?.geocode?.longitude;
  if (lat === undefined || lon === undefined) return null;
  return {
    ...toEntity(raw),
    lat,
    lon,
    address: raw.properties?.address ?? null,
    hours: raw.properties?.hours ?? null,
    liveMusic: raw.properties?.live_music ?? null,
    goodFor: [...(raw.properties?.good_for ?? [])]
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .flatMap((g) => (g.name ? [g.name] : []))
      .slice(0, 3),
    keywords: [...(raw.properties?.keywords ?? [])]
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .map((k) => k.name)
      .filter(Boolean)
      .slice(0, 3),
  };
}

/** Validate each entity on its own, so one odd record doesn't sink the list. */
export function parseEntities(items: unknown[]): { entities: RawEntity[]; skipped: number } {
  const entities: RawEntity[] = [];
  for (const item of items) {
    const parsed = entitySchema.safeParse(item);
    if (parsed.success) entities.push(parsed.data);
  }
  return { entities, skipped: items.length - entities.length };
}

/**
 * The top-level explainability aggregate (live shape:
 * `{effect_on_top3_recs: [{entity_id, avg_score}], effect_on_top5_recs, effect_on_top10_recs, effect_on_all_recs}`)
 * as one row per input entity.
 */
export function toImpact(aggregate: z.infer<typeof explainabilityAggregateSchema> | undefined): Impact[] {
  const block = aggregate?.["signal.interests.entities"];
  if (!block) return [];
  const byId = new Map<string, Impact>();
  const read = (rows: { entity_id: string; avg_score: number }[] | undefined, key: "top3" | "top5" | "top10" | "all") => {
    for (const row of rows ?? []) {
      const impact = byId.get(row.entity_id) ?? { entityId: row.entity_id, top3: null, top5: null, top10: null, all: null };
      impact[key] = row.avg_score;
      byId.set(row.entity_id, impact);
    }
  };
  read(block.effect_on_top3_recs, "top3");
  read(block.effect_on_top5_recs, "top5");
  read(block.effect_on_top10_recs, "top10");
  read(block.effect_on_all_recs, "all");
  return [...byId.values()];
}
