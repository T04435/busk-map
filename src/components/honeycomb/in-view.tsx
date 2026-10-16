"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";

/**
 * Marks its children in view the first time they scroll on screen (`data-inview="true"`), so a one-shot CSS animation plays
 * when it is seen, not on page load far above it. The CSS keeps the animation paused while `data-inview="false"`.
 */
export function InView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setSeen(true);
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen]);
  return (
    <span ref={ref} data-inview={seen} className={cn("block", className)}>
      {children}
    </span>
  );
}
