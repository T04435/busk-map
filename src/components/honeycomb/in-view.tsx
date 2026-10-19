"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";

/**
 * Plays a one-shot CSS animation when its children first scroll on screen, not on page load far above them. Progressive:
 * the server renders no `data-inview`, so the children are fully visible with no JS, slow JS, crawlers and screenshots.
 * Once JS runs, an off-screen wrapper is marked `ready` (the CSS holds the animation at its first frame) and then `true`
 * when it enters view (the CSS plays it). A wrapper already on screen when JS runs stays as it is, with no animation.
 */
export function InView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<"static" | "ready" | "true">("static");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setState("true");
        }
      },
      { threshold: 0.4 },
    );
    // Marked ready from the observer's first callback, not synchronously in the effect.
    let first = true;
    const ready = new IntersectionObserver(() => {
      if (first) {
        first = false;
        ready.disconnect();
        setState((s) => (s === "static" ? "ready" : s));
        observer.observe(el);
      }
    });
    ready.observe(el);
    return () => {
      observer.disconnect();
      ready.disconnect();
    };
  }, []);
  return (
    <span ref={ref} data-inview={state === "static" ? undefined : state} className={cn("block", className)}>
      {children}
    </span>
  );
}
