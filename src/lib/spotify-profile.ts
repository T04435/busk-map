import type { SpotifyProfile } from "@/lib/playlist-schema";

const PHOTO_PX = 160;

/** The smallest photo at least `minPx` wide (default PHOTO_PX), else the first one; https only. Null when there is none. */
export function profilePhoto(images: SpotifyProfile["images"], minPx = PHOTO_PX): string | null {
  const usable = images.filter((i) => i.url.startsWith("https://"));
  const wide = usable.filter((i) => (i.width ?? 0) >= minPx).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (wide[0] ?? usable[0])?.url ?? null;
}
