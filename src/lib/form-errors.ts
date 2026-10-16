/**
 * A plan request that fails planRequestSchema, in words that name the form field (B-003),
 * instead of a generic "check the form".
 */
import type { z } from "zod";
import type { PlanRequestInput } from "./plan-schema";

type Issue = Pick<z.core.$ZodIssue, "path" | "message">;

const FIELD_LABELS: [prefix: string, label: string][] = [
  ["performer.name", "Act name"],
  ["performer.spotifyArtists", "Artists you sound like"],
  ["performer.artists", "Artists you sound like"],
  ["performer.songs", "Songs you can play"],
  ["performer.fillSuggested", "Suggested songs"],
  ["performer.skipSongs", "Songs left out"],
  ["slot", "Date and times"],
  ["permit", "Permit"],
];

/** The form field label for a schema path such as "performer.songs.2.title", or null when no field matches. */
export function fieldLabel(path: string): string | null {
  return FIELD_LABELS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}.`))?.[1] ?? null;
}

/** One message for the first failing field, naming it. */
export function planFormError(issues: Issue[], input: PlanRequestInput): string {
  const issue = issues[0];
  const path = (issue?.path ?? []).map(String);
  const key = path.join(".");
  if (key === "performer.artists") return "Add at least one artist you sound like.";
  if (key.startsWith("slot")) {
    // Legacy fixed shapes (URLs, examples) keep their hour message; the main slot error is the date.
    const slot = input.slot as { startHour?: unknown; endHour?: unknown } | undefined;
    if (slot && ("startHour" in slot || "endHour" in slot)) return "Check the date and times: the slot must end after it starts and last at most 6 hours.";
    return "Date: Pick today or a later date.";
  }
  if (key === "performer.fillSuggested") return "Suggested songs: ask for between 1 and 8, or turn them off.";
  if (key.startsWith("performer.skipSongs")) return "Songs left out: check the songs you removed (up to 60, each with a title and an artist).";
  if (key.startsWith("performer.spotifyArtists.")) {
    const name = input.performer.spotifyArtists?.[Number(path[2])]?.name;
    return `Artists you sound like: Busk Map can't use the Spotify id for ${name ?? "an artist"}. Remove it and pick it again, or type the name.`;
  }
  if (key.startsWith("performer.songs.")) {
    const song = input.performer.songs?.[Number(path[2])];
    return `Songs you can play: check ${song?.title ? `“${song.title}”` : `song ${Number(path[2]) + 1}`} (${issue.message}).`;
  }
  const label = fieldLabel(key);
  return label ? `${label}: ${issue.message}` : `Check the form and try again (${key || "request"}: ${issue?.message ?? "invalid"}).`;
}

type UnionIssue = Issue & { code?: string; errors?: Issue[][] };

/**
 * The field paths of failing issues. An invalid union (the slot: fixed hours or any time) is expanded to the paths
 * inside its fixed branch, so an API caller still sees "slot.date" rather than only "slot".
 */
export function issuePaths(issues: UnionIssue[], prefix: string[] = []): string[] {
  return issues.flatMap((issue) => {
    const path = [...prefix, ...issue.path.map(String)];
    if (issue.code === "invalid_union" && issue.errors?.length) {
      const branch = issue.errors.find((e) => e.some((i) => i.path.length > 0)) ?? issue.errors[0];
      return issuePaths(branch as UnionIssue[], path);
    }
    return [path.join(".") || "(body)"];
  });
}
