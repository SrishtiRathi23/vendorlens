import { type CategoryKey, isCoverageTag } from "@/domain/categories";
import type { ExtractionAi } from "@/domain/contracts";
import { isIsoDate } from "@/domain/dates";
import { provenanceFor } from "@/domain/evidence";
import type { IdFactory } from "@/domain/ids";
import { rupeesToPaise } from "@/domain/money";
import type { CostTerm, Provenance, Quote } from "@/domain/schemas";

const INR = /^(inr|₹|rs\.?|rupees?)$/i;

export function isRupeeCurrency(currency: string): boolean {
  return currency.trim() === "" || INR.test(currency.trim());
}

interface Recorder {
  provenance: Record<string, Provenance>;
  evidence: Record<string, string>;
}

function record(rec: Recorder, path: string, source: string, excerpt: string, numbers: number[] = []): boolean {
  const state = provenanceFor(source, excerpt, numbers);
  rec.provenance[path] = state;
  if (excerpt) rec.evidence[path] = excerpt.slice(0, 400);
  return state === "matched";
}

function costTerm(rec: Recorder, path: string, source: string, term: ExtractionAi["transport"]): CostTerm {
  if (term.state === "unknown") return { state: "unknown" };
  const numbers = term.state === "amount" && term.rupees !== null ? [term.rupees] : [];
  if (!record(rec, path, source, term.evidence, numbers)) return { state: "unknown" };
  if (term.state === "amount") {
    const paise = term.rupees === null ? null : rupeesToPaise(term.rupees);
    return paise === null ? { state: "unknown" } : { state: "amount", paise };
  }
  return { state: term.state };
}

/**
 * Converts Gemini's extraction into an **unconfirmed** quote. Every value is checked against the
 * pasted text: a figure whose excerpt isn't in the quote, or whose excerpt doesn't contain that
 * figure, becomes unknown instead of being trusted. The user still has to confirm the result.
 */
export function quoteFromExtraction(
  extraction: ExtractionAi,
  options: { sourceText: string; category: CategoryKey; newId: IdFactory },
): Quote {
  const { sourceText: src, category, newId } = options;
  const rec: Recorder = { provenance: {}, evidence: {} };

  const aliasOk =
    extraction.vendorAlias.value !== null && record(rec, "vendorAlias", src, extraction.vendorAlias.evidence);

  const lines = extraction.lines.map((line, index) => {
    const numbers = [line.unitRupees, line.quantity].filter((n): n is number => n !== null);
    const ok = record(rec, `lines.${String(index)}`, src, line.evidence, numbers);
    return {
      id: newId(),
      description: line.description || "Item",
      basis: line.basis,
      unitPaise: ok && line.unitRupees !== null ? rupeesToPaise(line.unitRupees) : null,
      quantity: ok ? line.quantity : null,
      mandatory: true,
    };
  });

  const inclusions = extraction.inclusions
    .filter((item) => isCoverageTag(category, item.tag))
    .filter((item) => record(rec, `inclusions.${item.tag}`, src, item.evidence))
    .map((item) => item.tag);

  const exclusions = extraction.exclusions
    .filter((item, index) => record(rec, `exclusions.${String(index)}`, src, item.evidence))
    .map((item) => item.text);

  const tax = extraction.tax;
  const taxNumbers = [tax.ratePercent, tax.statedRupees].filter((n): n is number => n !== null);
  const taxOk = tax.mode !== "unknown" && record(rec, "terms.tax", src, tax.evidence, taxNumbers);
  const taxMode = taxOk ? tax.mode : "unknown";

  // "Balance on the event day" implies the remaining share without writing it, so that figure
  // isn't required in the excerpt; the schedule must still add up to exactly 100% to be used.
  const schedule = extraction.paymentSchedule
    .filter((step, index) => {
      const impliesRemainder = /\b(balance|remaining|rest)\b/i.test(step.evidence);
      return record(
        rec,
        `terms.paymentSchedule.${String(index)}`,
        src,
        step.evidence,
        impliesRemainder ? [] : [step.percent],
      );
    })
    .map((step) => ({ shareBp: Math.round(step.percent * 100), when: step.when, days: step.days }))
    .filter((step) => step.shareBp > 0);

  const refundOk =
    extraction.depositRefundable.value !== "unknown" &&
    record(rec, "terms.depositRefundable", src, extraction.depositRefundable.evidence);
  const cancellationOk =
    extraction.cancellation.value !== null && record(rec, "terms.cancellation", src, extraction.cancellation.evidence);
  const validity = extraction.validUntil.value;
  const validOk =
    validity !== null && isIsoDate(validity) && record(rec, "terms.validUntil", src, extraction.validUntil.evidence);
  const guests = extraction.guestCountAssumed.value;
  const guestsOk =
    guests !== null && record(rec, "guestCountAssumed", src, extraction.guestCountAssumed.evidence, [guests]);

  return {
    id: newId(),
    category,
    vendorAlias: aliasOk ? (extraction.vendorAlias.value ?? "Vendor") : "Unnamed vendor",
    sourceType: "pasted",
    sourceText: src,
    lines,
    inclusions: [...new Set(inclusions)],
    exclusions,
    terms: {
      taxMode,
      taxRateBp: taxOk && tax.ratePercent !== null ? Math.round(tax.ratePercent * 100) : null,
      statedTaxPaise: taxOk && tax.statedRupees !== null ? rupeesToPaise(tax.statedRupees) : null,
      transport: costTerm(rec, "terms.transport", src, extraction.transport),
      staffing: costTerm(rec, "terms.staffing", src, extraction.staffing),
      setup: costTerm(rec, "terms.setup", src, extraction.setup),
      paymentSchedule: schedule,
      depositRefundable: refundOk ? extraction.depositRefundable.value : "unknown",
      cancellation: cancellationOk ? (extraction.cancellation.value ?? "") : "",
      validUntil: validOk ? validity : null,
    },
    guestCountAssumed: guestsOk ? guests : null,
    provenance: rec.provenance,
    evidence: rec.evidence,
    aiQuestions: extraction.suggestedQuestions.slice(0, 3),
    confirmed: false,
  };
}

/** A blank quote for manual entry. Every cost starts unknown, never zero. */
export function emptyQuote(category: CategoryKey, sourceText: string, newId: IdFactory): Quote {
  return {
    id: newId(),
    category,
    vendorAlias: "",
    sourceType: "manual",
    sourceText,
    lines: [{ id: newId(), description: "", basis: "per_guest", unitPaise: null, quantity: null, mandatory: true }],
    inclusions: [],
    exclusions: [],
    terms: {
      taxMode: "unknown",
      taxRateBp: null,
      statedTaxPaise: null,
      transport: { state: "unknown" },
      staffing: { state: "unknown" },
      setup: { state: "unknown" },
      paymentSchedule: [],
      depositRefundable: "unknown",
      cancellation: "",
      validUntil: null,
    },
    guestCountAssumed: null,
    provenance: {},
    evidence: {},
    aiQuestions: [],
    confirmed: false,
  };
}
