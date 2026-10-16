"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cn } from "cn";

const KEY = "bm-motion";
const EVENT = "bm-motion";

const isPaused = () => document.documentElement.dataset.motion === "paused";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

function setPaused(paused: boolean) {
  if (paused) document.documentElement.dataset.motion = "paused";
  else delete document.documentElement.dataset.motion;
  try {
    if (paused) window.localStorage.setItem(KEY, "paused");
    else window.localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/**
 * One control that pauses every looping animation on the page (WCAG 2.2.2: motion longer than 5 seconds beside other content
 * can be paused): the ticker, the hero glow, the brain sketch's pulse. It sets `data-motion="paused"` on the root, and the CSS
 * pauses each loop there. The choice is remembered on this device. Reduced motion stops them all anyway.
 */
export function MotionPause({ className }: { className?: string }) {
  const paused = useSyncExternalStore(subscribe, isPaused, () => false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "paused") setPaused(true);
    } catch {}
  }, []);
  return (
    <button
      type="button"
      onClick={() => setPaused(!paused)}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center border-2 border-current px-3 font-mono text-xs leading-4 font-bold tracking-[0.06em] whitespace-nowrap uppercase",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none",
        className,
      )}
    >
      {paused ? "Play motion" : "Pause motion"}
    </button>
  );
}
