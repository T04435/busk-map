"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
 * "Copy": the set as plain text. The clipboard write runs inside the click handler (user activation); if both copy paths
 * fail the text is shown, selected, to copy by hand. "Copied" is shown and announced.
 */
export function CopySetButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state !== "copied") return;
    const t = setTimeout(() => setState("idle"), 2400);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (state === "manual") area.current?.select();
  }, [state]);

  function copy() {
    const done = (ok: boolean) => setState(ok ? "copied" : copyWithSelection(text) ? "copied" : "manual");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => done(true),
        () => done(false),
      );
    } else {
      done(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant="outline" size="sm" className="min-h-11 font-mono" onClick={copy} data-testid="copy-set">
        {state === "copied" ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        {state === "copied" ? "Copied" : "Copy"}
      </Button>
      {state === "manual" && (
        <Textarea
          ref={area}
          readOnly
          rows={5}
          value={text}
          aria-label="The set as text"
          className="min-h-0 w-72 max-w-full p-2 font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
      <span className="sr-only" role="status">
        {state === "copied" ? "Copied" : state === "manual" ? "Copy the set from the box" : ""}
      </span>
    </div>
  );
}
