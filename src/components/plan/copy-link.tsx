"use client";

import { CheckIcon, LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { planPath } from "@/lib/plan-id";

/** The legacy copy path, for browsers without the async clipboard (or when it is refused). */
function copyWithSelection(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/**
 * "Copy link": the plan's short URL. The clipboard write runs inside the click
 * handler (user activation); if both copy paths fail, the link is shown,
 * selected, to copy by hand.
 */
export function CopyLink({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const [url, setUrl] = useState("");

  // The "copied" look lasts about 2.4 s.
  useEffect(() => {
    if (state !== "copied") return;
    const t = setTimeout(() => setState("idle"), 2400);
    return () => clearTimeout(t);
  }, [state]);

  function copy() {
    const link = `${window.location.origin}${planPath(id)}`;
    setUrl(link);
    const done = (ok: boolean) => setState(ok ? "copied" : copyWithSelection(link) ? "copied" : "manual");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(
        () => done(true),
        () => done(false),
      );
    } else {
      done(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant={state === "copied" ? "secondary" : "outline"} onClick={copy} data-testid="copy-link">
        {state === "copied" ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
        {state === "copied" ? "Link copied" : "Copy link"}
      </Button>
      {state === "manual" && (
        <div className="flex flex-col gap-1">
          <p className="m-0 text-sm text-muted-foreground">Your browser didn&apos;t let us copy it. It&apos;s selected: press Ctrl+C or ⌘C, or long-press to copy.</p>
          <Input
          readOnly
          value={url}
          aria-label="Plan link"
          className="w-72 max-w-full font-mono text-sm"
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "Link copied" : state === "manual" ? "Copy the link from the box" : ""}
      </span>
    </div>
  );
}
