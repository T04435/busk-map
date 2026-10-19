"use client";

import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/honeycomb/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const fieldId = useId();

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

  // The clipboard is refused: the button gives way to a read-only field holding the link, selected (the DS CopyLinkButton fallback).
  if (state === "manual")
    return (
      <div className="grid max-w-[420px] gap-1.5">
        <Label htmlFor={fieldId}>Copy this link</Label>
        <Input id={fieldId} readOnly value={url} className="font-mono text-sm" autoFocus onFocus={(event) => event.currentTarget.select()} />
        <p className="m-0 text-sm leading-5 text-muted-foreground">Your browser didn&apos;t let us copy it. It&apos;s selected: press Ctrl+C or ⌘C, or long-press to copy.</p>
      </div>
    );
  return (
    <Button type="button" size="sm" variant={state === "copied" ? "secondary" : "outline"} onClick={copy} aria-live="polite" data-testid="copy-link">
      <Icon name={state === "copied" ? "check" : "copy"} size={14} />
      {state === "copied" ? "Link copied" : "Copy link"}
    </Button>
  );
}
