import { describe, expect, it } from "vitest";
import { compareQuotes } from "@/domain/compare";
import { normalizeQuote } from "@/domain/quote-normalize";
import { vendorQuestions } from "@/domain/questions";
import { context, quote, requirement } from "../helpers/factories";

describe("normalizeQuote", () => {
  it("Q01 · per-plate pricing multiplies by the event's guest count exactly", () => {
    const result = normalizeQuote(quote(), context());
    expect(result.basePaise).toBe(8_500_000);
    expect(result.knownTotalPaise).toBe(8_500_000);
    expect(result.perGuestPaise).toBe(85_000);
    expect(result.status).toBe("comparable");
  });

  it("Q02 · included, known-exclusive and unknown tax give three distinct results", () => {
    const included = normalizeQuote(quote({}, { taxMode: "included" }), context());
    const known = normalizeQuote(quote({}, { taxMode: "exclusive_known", taxRateBp: 500 }), context());
    const stated = normalizeQuote(quote({}, { taxMode: "exclusive_known", statedTaxPaise: 1_00 }), context());
    const unknown = normalizeQuote(quote({}, { taxMode: "exclusive_unknown" }), context());

    expect(included.knownTaxPaise).toBe(0);
    expect(known.knownTaxPaise).toBe(425_000);
    expect(known.knownTotalPaise).toBe(8_925_000);
    expect(stated.knownTaxPaise).toBe(1_00);
    expect(unknown.knownTaxPaise).toBeNull();
    expect(unknown.status).toBe("incomplete");
    expect(unknown.knownTotalPaise).toBe(8_500_000);
  });

  it("Q03 · an unknown required transport cost makes the quote incomplete, not ₹0", () => {
    const needsTransport = context({ requirements: [requirement({ coverageTags: ["transport"] })] });
    const result = normalizeQuote(quote({ inclusions: [] }, { transport: { state: "unknown" } }), needsTransport);
    expect(result.status).toBe("incomplete");
    expect(result.unknowns).toContainEqual({ field: "terms.transport", label: "Transport charge", blocking: true });
    expect(result.knownExtrasPaise).toBe(0);
  });

  it("lists optional unknowns without blocking comparison", () => {
    const result = normalizeQuote(quote({}, { setup: { state: "unknown" } }), context());
    expect(result.unknowns).toEqual([{ field: "terms.setup", label: "Setup charge", blocking: false }]);
    expect(result.status).toBe("comparable");
  });

  it("Q05 · flat, per-guest, per-hour and per-unit lines normalise; missing quantities stay unknown", () => {
    const lines = [
      {
        id: "a",
        description: "Venue hire",
        basis: "flat" as const,
        unitPaise: 50_000_00,
        quantity: null,
        mandatory: true,
      },
      {
        id: "b",
        description: "Plates",
        basis: "per_guest" as const,
        unitPaise: 500_00,
        quantity: null,
        mandatory: true,
      },
      { id: "c", description: "DJ", basis: "per_hour" as const, unitPaise: 3_000_00, quantity: 4, mandatory: true },
      {
        id: "d",
        description: "Chairs",
        basis: "per_unit" as const,
        unitPaise: 50_00,
        quantity: null,
        mandatory: false,
      },
    ];
    const result = normalizeQuote(quote({ lines }), context());
    expect(result.basePaise).toBe(50_000_00 + 500_00 * 100 + 3_000_00 * 4);
    expect(result.unknowns).toEqual([{ field: "lines.3", label: "Price of “Chairs”", blocking: false }]);
  });

  it("Q07 · an expired quote is a mismatch, never silently extended", () => {
    const result = normalizeQuote(quote({}, { validUntil: "2026-10-20" }), context());
    expect(result.status).toBe("mismatch");
    expect(result.mismatches[0]).toContain("expired");
  });

  it("flags a quote priced for a different guest count", () => {
    const result = normalizeQuote(quote({ guestCountAssumed: 80 }), context());
    expect(result.status).toBe("mismatch");
  });

  it("Q08 · an uncovered required item blocks the comparable status", () => {
    const result = normalizeQuote(quote({ inclusions: ["service_staff"] }), context());
    expect(result.missingTags).toEqual(["Crockery"]);
    expect(result.status).toBe("incomplete");
  });
});

describe("compareQuotes and vendor questions", () => {
  it("names a lowest known total only when every quote is comparable", () => {
    const a = normalizeQuote(quote({ id: "a", vendorAlias: "A" }), context());
    const b = normalizeQuote(
      quote({
        id: "b",
        vendorAlias: "B",
        lines: [
          { id: "x", description: "Plate", basis: "per_guest", unitPaise: 900_00, quantity: null, mandatory: true },
        ],
      }),
      context(),
    );
    expect(compareQuotes([a, b]).lowestKnownTotalId).toBe("a");
    expect(compareQuotes([a, b]).verdict).toContain("₹5,000");

    const incomplete = normalizeQuote(quote({ id: "c", vendorAlias: "C" }, { taxMode: "unknown" }), context());
    const blocked = compareQuotes([a, incomplete]);
    expect(blocked.lowestKnownTotalId).toBeNull();
    expect(blocked.verdict).toContain("C has unknown");
    expect(compareQuotes([a]).lowestKnownTotalId).toBeNull();
  });

  it("asks one concrete question per unknown, gap and mismatch, without duplicates", () => {
    const q = quote(
      { inclusions: [], guestCountAssumed: 80 },
      { taxMode: "unknown", paymentSchedule: [{ shareBp: 10_000, when: "on_booking", days: null }] },
    );
    const questions = vendorQuestions(q, normalizeQuote(q, context()), [
      "Is GST included in this price? If not, which rate applies and to which items?",
    ]);
    expect(questions).toContain("Is GST included in this price? If not, which rate applies and to which items?");
    expect(questions.some((text) => text.includes("crockery"))).toBe(true);
    expect(questions.some((text) => text.includes("Priced for 80 guests"))).toBe(true);
    expect(questions.some((text) => text.includes("refundable"))).toBe(true);
    expect(new Set(questions).size).toBe(questions.length);
  });
});
