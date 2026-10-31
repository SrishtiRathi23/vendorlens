import type { NormalizeContext } from "@/domain/quote-normalize";
import type { Quote, Requirement } from "@/domain/schemas";

export const TODAY = "2026-11-01";
export const EVENT_DATE = "2027-02-14";

export function requirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: "req-1",
    category: "catering",
    label: "Caterer",
    required: true,
    coverageTags: ["service_staff", "crockery"],
    why: "",
    questions: [],
    bookByLeadDays: 90,
    bookBy: "2026-11-16",
    priority: "high",
    status: "not_contacted",
    contact: { name: "", phone: "", email: "" },
    notes: "",
    decided: false,
    ...overrides,
  };
}

export function quote(overrides: Partial<Quote> = {}, terms: Partial<Quote["terms"]> = {}): Quote {
  return {
    id: "q-1",
    category: "catering",
    vendorAlias: "Test Caterer",
    sourceType: "manual",
    sourceText: "",
    lines: [
      {
        id: "l-1",
        description: "Dinner per plate",
        basis: "per_guest",
        unitPaise: 850_00,
        quantity: null,
        mandatory: true,
      },
    ],
    inclusions: ["service_staff", "crockery"],
    exclusions: [],
    guestCountAssumed: null,
    provenance: {},
    evidence: {},
    aiQuestions: [],
    confirmed: true,
    ...overrides,
    terms: {
      taxMode: "included",
      taxRateBp: null,
      statedTaxPaise: null,
      transport: { state: "included" },
      staffing: { state: "included" },
      setup: { state: "included" },
      paymentSchedule: [],
      depositRefundable: "unknown",
      cancellation: "",
      validUntil: null,
      ...terms,
    },
  };
}

export function context(overrides: Partial<NormalizeContext> = {}): NormalizeContext {
  return { guestCount: 100, eventDate: EVENT_DATE, today: TODAY, requirements: [requirement()], ...overrides };
}
