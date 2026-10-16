import { Fragment } from "react";
import { PercentCell } from "@/components/honeycomb/percent-cell";

/**
 * Prose from the server can carry a score as "87/100". The brand never shows that in text: this swaps each one for an inline
 * PercentCell (the spoken label keeps "87 out of 100"). Everything else passes through untouched.
 */
export function WithCells({ text, size = 32 }: { text: string; size?: number }) {
  const parts = text.split(/(\d{1,3}\/100)/);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^(\d{1,3})\/100$/.exec(part);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        return <PercentCell key={i} value={Number(m[1])} size={size} className="mx-1 align-middle" />;
      })}
    </>
  );
}
