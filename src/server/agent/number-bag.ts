/**
 * A loose guard for "every number comes from a tool": the numbers in the
 * final text must be close to a number the model was shown (in the prompt or
 * a tool result), allowing for rounding and 0–1 values written out of 100.
 */
export class NumberBag {
  private readonly values: number[] = [];
  add(value: unknown) {
    const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    for (const match of text.matchAll(/-?\d+(?:\.\d+)?/g)) {
      const n = Number(match[0]);
      if (!Number.isFinite(n)) continue;
      this.values.push(n);
      if (Math.abs(n) <= 1 && !Number.isInteger(n)) this.values.push(Math.round(n * 100));
      if (Number.isInteger(n) && n >= 13 && n <= 23) this.values.push(n - 12);
    }
  }
  has(n: number): boolean {
    // Small counts and round markers ("3 pitches", "/100") need no source.
    if (Number.isInteger(n) && n >= 0 && n <= 10) return true;
    if (n === 100) return true;
    return this.values.some((v) => (Math.abs(v) >= 100 ? Math.abs(v - n) <= Math.abs(v) * 0.03 : Math.abs(v - n) <= 0.5));
  }
  /** Numbers in the text with no source. */
  unknownIn(text: string): string[] {
    const out: string[] = [];
    for (const match of text.replaceAll(/(\d),(\d{3})/g, "$1$2").matchAll(/\d+(?:\.\d+)?/g)) {
      if (!this.has(Number(match[0]))) out.push(match[0]);
    }
    return [...new Set(out)];
  }
}

