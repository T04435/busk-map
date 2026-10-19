/**
 * Labels and data sources of the learn run's tools (docs/playlist-architecture.md §7.1), looked up by stream kind and
 * tool: `crowd_at` exists in the busk agent too, with a different output and label. Client-safe.
 */
export type StreamKind = "plan" | "learn";

export const LEARN_TOOL_LABELS: Record<string, string> = {
  match_playlist: "Matching your songs on Qloo",
  history: "Reading your earlier runs",
  crowd_at: "Who the crowd likes at your pitch",
  related_artists: "Artists your fans also like",
  rising: "Who's rising with those crowds",
  crowd_profile: "The age of your fans",
  top_tracks: "Top songs by those artists",
  finish_suggestions: "Choosing and explaining",
};

/** The data call behind each learn tool, shown next to the step. */
export const LEARN_TOOL_SOURCES: Record<string, string> = {
  match_playlist: "Qloo /search or /entities (stored ids first)",
  history: "Your Repertoire and earlier runs (no model)",
  crowd_at: "Qloo /v2/insights · urn:entity:artist with signal.location and explainability",
  related_artists: "Qloo /v2/insights · urn:entity:artist with signal.interests.entities and explainability",
  rising: "Qloo /v2/trending · urn:entity:artist, with audience growth",
  crowd_profile: "Qloo /v2/insights · urn:demographics",
  top_tracks: "Spotify track search by artist, Last.fm top tracks as backup; earlier suggestions left out by the server",
  finish_suggestions: "Checked against this run's songs and your history",
};

/** The tool label for a step, by the kind of stream it came from. */
export function toolLabel(kind: StreamKind, tool: string, fallback: string): string {
  return kind === "learn" ? (LEARN_TOOL_LABELS[tool] ?? fallback) : fallback;
}

/** The tools whose answer can be rejected (shown as a "rejected" badge instead of "failed"). */
export const FINISH_TOOLS: Record<StreamKind, string> = { plan: "finish_plan", learn: "finish_suggestions" };
