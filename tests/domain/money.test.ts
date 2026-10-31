import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { allocate } from "@/domain/allocation";
import {
  applyBasisPoints,
  formatINR,
  isPaise,
  MAX_PAISE,
  multiplyPaise,
  parseRupeeInput,
  rupeesToPaise,
  sumPaise,
} from "@/domain/money";

describe("money in integer paise", () => {
  it("Q01 · 100 guests × ₹850 is exactly ₹85,000 with no float drift", () => {
    const perPlate = parseRupeeInput("₹850");
    expect(perPlate).toBe(85_000);
    expect(multiplyPaise(perPlate ?? 0, 100)).toBe(8_500_000);
    expect(formatINR(8_500_000)).toBe("₹85,000");
  });

  it("parses the ways people type amounts", () => {
    expect(parseRupeeInput("8,50,000")).toBe(85_000_000);
    expect(parseRupeeInput("Rs. 950/-")).toBe(95_000);
    expect(parseRupeeInput("1200.5")).toBe(120_050);
    expect(parseRupeeInput("12.345")).toBeNull();
    expect(parseRupeeInput("-5")).toBeNull();
    expect(parseRupeeInput("ten")).toBeNull();
  });

  it("rejects negative, non-finite and out-of-range values", () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, 2e12]) expect(rupeesToPaise(bad)).toBeNull();
    expect(isPaise(1.5)).toBe(false);
    expect(isPaise(MAX_PAISE + 1)).toBe(false);
    expect(multiplyPaise(MAX_PAISE, 2)).toBeNull();
    expect(multiplyPaise(100, -1)).toBeNull();
  });

  it("rounds a basis-point rate once, half up", () => {
    expect(applyBasisPoints(10_000, 1_800)).toBe(1_800);
    expect(applyBasisPoints(1, 5_000)).toBe(1); // 0.5 paisa rounds up
    expect(applyBasisPoints(1, 4_999)).toBe(0);
  });

  it("formats paise only when present", () => {
    expect(formatINR(120_050)).toBe("₹1,200.50");
    expect(sumPaise([1, 2, 3])).toBe(6);
  });
});

describe("allocate (largest remainder)", () => {
  it("Q16 · parts always add up to the total exactly and are never negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_PAISE }),
        fc.array(fc.integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 12 }),
        (total, weights) => {
          const parts = allocate(total, weights);
          expect(parts).toHaveLength(weights.length);
          expect(sumPaise(parts)).toBe(total);
          expect(parts.every((part) => Number.isSafeInteger(part) && part >= 0)).toBe(true);
        },
      ),
    );
  });

  it("follows the weights and splits evenly when every weight is zero", () => {
    expect(allocate(100, [1, 1, 2])).toEqual([25, 25, 50]);
    expect(allocate(10, [0, 0, 0])).toEqual([4, 3, 3]);
    expect(allocate(5, [])).toEqual([]);
  });
});
