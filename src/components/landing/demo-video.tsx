"use client";

import { useRef, useState } from "react";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";

/**
 * L11, the landing demo video slot, ported from the DS board: a 16:9 night panel (3px rule, md shadow) holding a 96px orange
 * hex cell with the filled `play` icon (never an arrow, F22), and no visible label: the button's accessible name says what it plays (user, 20 Oct). No caption line.
 * The poster sits behind it under a night scrim. The whole panel is one button: pressing it loads the video (preload stays
 * "none" until then), starts it and gives native controls and focus to the player. It never autoplays. The captions are burned
 * into the picture, so the VTT track is offered in the captions menu but not switched on (it would print every line twice).
 */
export function DemoVideo() {
  const [started, setStarted] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  function start() {
    const v = video.current;
    if (!v) return;
    setStarted(true);
    v.controls = true;
    v.load();
    v.play().catch(() => {});
    v.focus();
  }

  return (
    <figure
      aria-label="Busk Map demo video"
      data-testid="demo-video-slot"
      data-started={started ? "true" : "false"}
      className="bm-grain relative m-0 flex w-full flex-col border-[3px] border-rule bg-background text-foreground shadow-md"
      data-theme="dark"
    >
      <video
        ref={video}
        playsInline
        preload="none"
        width={1280}
        height={720}
        poster="/video/busk-map-demo-poster.jpg"
        title="Busk Map demo"
        aria-label="Busk Map demo video, 1 min 28 s, with captions"
        className="block aspect-video max-h-[720px] w-full bg-background object-contain"
      >
        <source src="/video/busk-map-demo.mp4" type="video/mp4" />
        <track kind="captions" src="/video/busk-map-demo.en.vtt" srcLang="en" label="English" />
        <p>
          Your browser can&apos;t play the video. <a href="/video/busk-map-demo.mp4" className="underline">Download the demo (MP4)</a>.
        </p>
      </video>
      {started ? null : (
        <button
          type="button"
          onClick={start}
          aria-label="Play the Busk Map demo, 1 min 28 s"
          data-testid="demo-video-play"
          className="group absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 bg-background/85 px-4 text-center text-foreground focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
        >
          <span className="transition-transform duration-150 ease-out group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-active:scale-100">
            <HexCell size={96} tone="primary">
              <Icon name="play" size={40} />
            </HexCell>
          </span>
        </button>
      )}
    </figure>
  );
}
