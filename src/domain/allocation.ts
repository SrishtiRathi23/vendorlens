import type { Paise } from "@/domain/money";

/**
 * Splits `total` across `weights` with the largest-remainder method, so the parts are whole paise
 * and **always add up to `total` exactly**. Ties go to the earlier weight, which keeps the result
 * deterministic. All-zero weights split the total evenly.
 */
export function allocate(total: Paise, weights: readonly number[]): Paise[] {
  if (weights.length === 0) return [];
  const safeWeights = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const weightSum = safeWeights.reduce((sum, weight) => sum + weight, 0);
  const effective = weightSum === 0 ? safeWeights.map(() => 1) : safeWeights;
  const effectiveSum = weightSum === 0 ? effective.length : weightSum;

  const exact = effective.map((weight) => (total * weight) / effectiveSum);
  const parts = exact.map(Math.floor);
  let leftover = total - parts.reduce((sum, part) => sum + part, 0);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of byRemainder) {
    if (leftover === 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    leftover -= 1;
  }
  return parts;
}
