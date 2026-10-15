/** SQL fragments for the retention rule (retention-core.ts), shared by the plans and plan_store tables. */
/**
 * SQL: a jsonb array of stream events with each tool-end's raw output removed
 * (and `pruned: true`), order kept. The same rule as stripStepOutputs.
 */
export const stripEventsSql = (column: string) =>
  `(SELECT coalesce(jsonb_agg(CASE WHEN e->>'type' = 'tool-end' AND jsonb_exists(e, 'output') THEN (e - 'output') || '{"pruned": true}'::jsonb ELSE e END ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(${column}) WITH ORDINALITY AS t(e, ord))`;
/** SQL: whether a jsonb array of stream events still holds raw tool output. */
export const hasRawSql = (column: string) => `jsonb_path_exists(${column}, '$[*] ? (@.type == "tool-end" && exists(@.output))')`;
