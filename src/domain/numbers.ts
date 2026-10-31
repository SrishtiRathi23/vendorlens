/*
 * Reads numbers the way Indian vendor quotes write them: "₹1,50,000", "Rs. 950/-", "1.5 lakh",
 * "18% GST", "2 crore". Used to check that a figure the AI reported really appears in its excerpt.
 */

const NUMBER_TOKEN = /(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d+))?\s*(lakhs?|lacs?|crores?|cr\b|k\b)?/gi;

const MULTIPLIER: Record<string, number> = {
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  lacs: 100_000,
  crore: 10_000_000,
  crores: 10_000_000,
  cr: 10_000_000,
  k: 1_000,
};

/** Every numeric value written in `text`, with Indian grouping and lakh/crore/k suffixes applied. */
export function extractNumbers(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(NUMBER_TOKEN)) {
    const whole = (match[1] ?? "").replace(/,/g, "");
    const fraction = match[2] ?? "";
    const base = Number(fraction ? `${whole}.${fraction}` : whole);
    const scale = MULTIPLIER[(match[3] ?? "").toLowerCase()] ?? 1;
    if (Number.isFinite(base)) values.push(Math.round(base * scale * 100) / 100);
  }
  return values;
}

/** True when `value` is written somewhere in `excerpt` (compared to the paisa). */
export function numberAppearsIn(value: number, excerpt: string): boolean {
  const target = Math.round(value * 100);
  return extractNumbers(excerpt).some((found) => Math.round(found * 100) === target);
}
