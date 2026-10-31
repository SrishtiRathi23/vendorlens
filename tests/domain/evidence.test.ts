import { describe, expect, it } from "vitest";
import { normalizeForMatch, provenanceFor, verifyEvidence } from "@/domain/evidence";
import { extractNumbers, numberAppearsIn } from "@/domain/numbers";

const quote = "Wedding dinner: Rs. 950/- per plate.\nGST  5% extra.  Advance of ₹1,50,000 or 1.5 lakh on booking.";

describe("number reading", () => {
  it("understands rupee symbols, Indian grouping and lakh/crore", () => {
    expect(extractNumbers(quote)).toEqual([950, 5, 150_000, 150_000]);
    expect(extractNumbers("2 crore and 15k")).toEqual([20_000_000, 15_000]);
    expect(numberAppearsIn(950, "Rs. 950/- per plate")).toBe(true);
    expect(numberAppearsIn(950.5, "950")).toBe(false);
  });
});

describe("evidence verification", () => {
  it("matches excerpts despite case, spacing and Unicode differences", () => {
    expect(normalizeForMatch("  GST  5%  ")).toBe("gst 5%");
    expect(verifyEvidence(quote, "gst 5% extra")).toBe(true);
    expect(verifyEvidence(quote, "Rs. 950/- per plate.")).toBe(true);
  });

  it("Q09 · an excerpt that isn't in the quote is never reported as matched", () => {
    expect(verifyEvidence(quote, "Service staff included")).toBe(false);
    expect(verifyEvidence(quote, "")).toBe(false);
    expect(verifyEvidence(quote, "Rs")).toBe(false); // too short to mean anything
    expect(provenanceFor(quote, "free decoration included")).toBe("not_found");
  });

  it("Q10 · a figure missing from its own excerpt is not_found (AI said ₹850, quote says ₹950)", () => {
    expect(provenanceFor(quote, "Rs. 950/- per plate", [950])).toBe("matched");
    expect(provenanceFor(quote, "Rs. 950/- per plate", [850])).toBe("not_found");
  });
});
