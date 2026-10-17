"use client";

import { useId, type FormEvent } from "react";
import { cn } from "cn";
import { AiChip } from "@/components/honeycomb/ai-chip";
import { FormMessage } from "@/components/honeycomb/form-message";
import { AGENT_NAME_START } from "@/lib/agent-persona";
import { Icon } from "@/components/honeycomb/icon";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

/**
 * The empty /repertoire: one poster block, one field (a Spotify artist link), one button. Nothing else on the page.
 */
export function RepertoireEmpty({
  value,
  onChange,
  onSubmit,
  busy,
  error,
  className,
}: {
  value: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  busy?: boolean;
  error?: string | null;
  className?: string;
}) {
  const headingId = useId();
  const errorId = useId();
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!busy) onSubmit?.();
  };
  return (
    <section
      data-slot="repertoire-empty"
      className={cn(
        "border-2 border-rule bg-card p-[clamp(20px,5vw,48px)] shadow-[8px_8px_0_var(--primary)]",
        className,
      )}
    >
      <h1
        id={headingId}
        className="m-0 max-w-3xl font-display text-[clamp(32px,5vw,56px)] leading-[1.02] font-extrabold text-balance uppercase"
      >
        Paste your Spotify artist link
      </h1>
      <p className="mt-4 mb-0 max-w-2xl text-lg leading-7 text-muted-foreground">
        {AGENT_NAME_START} reads your profile, finds you on Qloo, and builds your Repertoire: your fans, your sound-alikes and songs to
        learn.
      </p>
      <AiChip className="mt-3" />
      <form onSubmit={handleSubmit} noValidate className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <InputGroup className="h-14! sm:flex-1">
            <InputGroupAddon align="inline-start" className="pl-4">
              <Icon name="spotify" size={24} />
            </InputGroupAddon>
            <InputGroupInput
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="open.spotify.com/artist/…"
              aria-labelledby={headingId}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              value={value}
              disabled={busy}
              onChange={(e) => onChange?.(e.target.value)}
              className="h-14 text-lg md:text-lg"
            />
          </InputGroup>
          <Button type="submit" variant="poster" size="lg" disabled={busy} className="h-14 w-full text-lg sm:w-auto">
            Research my act
            <Icon name="arrow-right" size={20} />
          </Button>
        </div>
        {error ? (
          <FormMessage tone="error" id={errorId} className="mt-3">
            {error}
          </FormMessage>
        ) : null}
      </form>
    </section>
  );
}
