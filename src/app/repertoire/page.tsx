import type { Metadata } from "next";
import { RepertoireView } from "@/components/playlist/repertoire-view";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

export const metadata: Metadata = {
  title: `${PLAYLIST_COPY.name} · Busk Map`,
  description: PLAYLIST_COPY.pageIntro,
};

export default function RepertoirePage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:py-12">
      <RepertoireView />
    </main>
  );
}
