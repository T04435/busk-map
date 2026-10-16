"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Disclosure } from "@/components/honeycomb/disclosure";
import { cn } from "cn";

const NARROW = "(max-width: 767px)";
const subscribe = (notify: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", notify);
  return () => mq.removeEventListener("change", notify);
};

/**
 * A long block of the brand page. From 768 px it is the heading and the content as they are; on phones it folds under a
 * Disclosure with the same heading as its label, closed, so a 23,000 px page reads in a few screens. The server
 * renders it open (the wide layout), and a phone folds it after hydration.
 */
export function PhoneFold({ heading, count, headingClassName, wideClassName, children }: { heading: string; count?: number; headingClassName: string; /** The wide layout's frame (a card), when the block sits in one. */ wideClassName?: string; children: ReactNode }) {
  const narrow = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
  if (narrow) {
    return (
      <Disclosure label={heading} count={count}>
        <div className="flex flex-col gap-4">{children}</div>
      </Disclosure>
    );
  }
  return (
    <div className={cn("flex flex-col gap-4", wideClassName)}>
      <h3 className={headingClassName}>{heading}</h3>
      {children}
    </div>
  );
}
