import { entitySchema, type Explanation, type QlooEntity, type QlooPlace, type RawEntity } from "./schema";

/**
 * Pull "which input entity drove this result" out of `query.explainability`.
 * The exact shape is not documented in detail, so accept any list of objects
 * with an entity id and a 0–1 score, found anywhere under the field.
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
    affinity: raw.query?.affinity ?? null,
    tags: (raw.tags ?? []).map((t) => ({ id: t.id, name: t.name ?? t.id })),
    explanation,
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
