"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { examplesForKey } from "@/lib/example-tips";
import { expectedHistory, historyKey, loadTips, performerKeyFor, summariesByPerformer, writeTipCookie, type TipHistory } from "@/lib/tips";

/**
 * Keep a server-rendered plan in step with this browser's tip log. The server
 * reads the log's summary from a cookie; if the cookie is missing or stale
 * (cleared, expired, another tab), rewrite it and re-render once.
 */
export function useTipSync(performerName: string, exampleId: string | null, rendered: TipHistory | null | undefined) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const entries = loadTips();
    const expected = expectedHistory(entries, performerKeyFor(performerName, exampleId), examplesForKey);
    if (historyKey(expected) === historyKey(rendered)) return;
    writeTipCookie(summariesByPerformer(entries, examplesForKey));
    router.refresh();
  }, [exampleId, performerName, rendered, router]);
}
