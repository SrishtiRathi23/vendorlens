/**
 * Money is always an integer number of paise (₹1 = 100 paise). Floating-point values never
 * represent money; they are converted once, at the edge, with explicit rounding.
 */
export type Paise = number;

/** ₹100 crore. Anything larger is treated as invalid input rather than a real event budget. */
export const MAX_PAISE: Paise = 100_000_000_000;

export function isPaise(value: unknown): value is Paise {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_PAISE;
}

/** Converts a rupee amount (possibly fractional, e.g. 850.5) to paise, or `null` if it is not a valid amount. */
export function rupeesToPaise(rupees: number): Paise | null {
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  const paise = Math.round(rupees * 100);
  return isPaise(paise) ? paise : null;
}

/**
 * Parses what a person types into a money field: "8,50,000", "₹ 1,200.50", "Rs. 950/-".
 * Returns `null` for anything that is not a single non-negative amount.
 */
export function parseRupeeInput(text: string): Paise | null {
  const cleaned = text
    .replace(/₹|rs\.?|inr|\/-/gi, "")
    .replace(/[,\s]/g, "")
    .trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return isPaise(paise) ? paise : null;
}

/** `amount × quantity`, refusing results that are not safe integers within range. */
export function multiplyPaise(amount: Paise, quantity: number): Paise | null {
  if (!isPaise(amount) || !Number.isSafeInteger(quantity) || quantity < 0) return null;
  const total = amount * quantity;
  return isPaise(total) ? total : null;
}

export function sumPaise(amounts: readonly Paise[]): Paise {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/**
 * Applies a rate in basis points (1800 = 18%) and rounds **once**, half up, to whole paise.
 * This is the only rounding rule used for tax and percentage splits.
 */
export function applyBasisPoints(amount: Paise, basisPoints: number): Paise {
  return Math.floor((amount * basisPoints + 5_000) / 10_000);
}

const wholeRupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const withPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** Indian-grouped rupees: ₹8,50,000 (paise shown only when present). */
export function formatINR(amount: Paise): string {
  return amount % 100 === 0 ? wholeRupees.format(amount / 100) : withPaise.format(amount / 100);
}
