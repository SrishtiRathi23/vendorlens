import { type CategoryKey, tagLabel } from "@/domain/categories";
import { type IsoDate } from "@/domain/dates";
import { applyBasisPoints, multiplyPaise, type Paise, sumPaise } from "@/domain/money";
import type { CostTerm, Quote, QuoteLine, Requirement } from "@/domain/schemas";

export type QuoteStatus = "comparable" | "incomplete" | "mismatch";

interface Unknown {
  field: string;
  label: string;
  /** Required unknowns block comparison; optional ones are shown but don't. */
  blocking: boolean;
}

export interface NormalizedQuote {
  quoteId: string;
  vendorAlias: string;
  basePaise: Paise;
  knownExtrasPaise: Paise;
  knownTaxPaise: Paise | null;
  knownTotalPaise: Paise;
  perGuestPaise: Paise;
  unknowns: Unknown[];
  missingTags: string[];
  mismatches: string[];
  status: QuoteStatus;
  /** Every amount that went into the known total, for "how was this calculated?". */
  breakdown: { label: string; paise: Paise }[];
}

export interface NormalizeContext {
  guestCount: number;
  eventDate: IsoDate;
  today: IsoDate;
  requirements: readonly Requirement[];
}

/** Coverage tags the event's *required* vendor needs in this category ask for. */
function requiredTags(requirements: readonly Requirement[], category: CategoryKey): string[] {
  return [...new Set(requirements.filter((r) => r.category === category && r.required).flatMap((r) => r.coverageTags))];
}

/**
 * Per-guest prices are always multiplied by **this event's** guest count, so quotes written for
 * different numbers become comparable; a different count assumed by the quote is reported as a
 * mismatch instead of being silently used.
 */
function lineQuantity(line: QuoteLine, guestCount: number): number | null {
  if (line.basis === "flat") return line.quantity ?? 1;
  if (line.basis === "per_guest") return guestCount;
  return line.quantity;
}

/** Cost-term names and the coverage tag that makes each one *required* for a category. */
const COST_TERMS = [
  { key: "transport", label: "Transport", tag: "transport" },
  { key: "staffing", label: "Service staff", tag: "service_staff" },
  { key: "setup", label: "Setup", tag: "setup" },
] as const;

function termPaise(term: CostTerm): Paise | null {
  if (term.state === "amount") return term.paise;
  return term.state === "unknown" ? null : 0;
}

/**
 * Turns a **confirmed** quote into comparable numbers. Nothing unknown is ever counted as ₹0: an
 * unpriced mandatory line, an unknown required extra or an unknown tax makes the quote `incomplete`,
 * and its total is labelled a *known* total.
 */
export function normalizeQuote(quote: Quote, context: NormalizeContext): NormalizedQuote {
  const unknowns: Unknown[] = [];
  const breakdown: { label: string; paise: Paise }[] = [];
  const needed = requiredTags(context.requirements, quote.category);

  for (const [index, line] of quote.lines.entries()) {
    const quantity = lineQuantity(line, context.guestCount);
    const total = line.unitPaise === null || quantity === null ? null : multiplyPaise(line.unitPaise, quantity);
    if (total === null) {
      unknowns.push({
        field: `lines.${String(index)}`,
        label: `Price of “${line.description}”`,
        blocking: line.mandatory,
      });
    } else {
      breakdown.push({ label: line.description, paise: total });
    }
  }
  const basePaise = sumPaise(breakdown.map((item) => item.paise));

  let knownExtrasPaise = 0;
  for (const { key, label, tag } of COST_TERMS) {
    const amount = termPaise(quote.terms[key]);
    if (amount === null) {
      unknowns.push({ field: `terms.${key}`, label: `${label} charge`, blocking: needed.includes(tag) });
    } else if (amount > 0) {
      knownExtrasPaise += amount;
      breakdown.push({ label, paise: amount });
    }
  }

  const knownTaxPaise = taxFor(quote, basePaise + knownExtrasPaise);
  if (knownTaxPaise === null) unknowns.push({ field: "terms.tax", label: "Tax (GST)", blocking: true });
  else if (knownTaxPaise > 0) breakdown.push({ label: "Tax", paise: knownTaxPaise });

  const coveredByPrice: string[] = COST_TERMS.filter(({ key }) => quote.terms[key].state !== "unknown").map(
    ({ tag }) => tag,
  );
  const missingTags = needed.filter(
    (tag) => !quote.inclusions.includes(tag) && !coveredByPrice.includes(tag) && tag !== "gst",
  );

  const mismatches: string[] = [];
  const hasPerGuest = quote.lines.some((line) => line.basis === "per_guest");
  if (hasPerGuest && quote.guestCountAssumed !== null && quote.guestCountAssumed !== context.guestCount) {
    mismatches.push(
      `Priced for ${String(quote.guestCountAssumed)} guests; your event has ${String(context.guestCount)}.`,
    );
  }
  if (quote.terms.validUntil !== null && quote.terms.validUntil < context.today) {
    mismatches.push(`Quote expired on ${quote.terms.validUntil}.`);
  }

  const knownTotalPaise = basePaise + knownExtrasPaise + (knownTaxPaise ?? 0);
  const blocked = unknowns.some((u) => u.blocking) || missingTags.length > 0;
  return {
    quoteId: quote.id,
    vendorAlias: quote.vendorAlias,
    basePaise,
    knownExtrasPaise,
    knownTaxPaise,
    knownTotalPaise,
    perGuestPaise: Math.floor(knownTotalPaise / Math.max(1, context.guestCount)),
    unknowns,
    missingTags: missingTags.map(tagLabel),
    mismatches,
    status: mismatches.length > 0 ? "mismatch" : blocked ? "incomplete" : "comparable",
    breakdown,
  };
}

function taxFor(quote: Quote, taxable: Paise): Paise | null {
  const { taxMode, statedTaxPaise, taxRateBp } = quote.terms;
  if (taxMode === "included") return 0;
  if (taxMode !== "exclusive_known") return null;
  if (statedTaxPaise !== null) return statedTaxPaise;
  return taxRateBp === null ? null : applyBasisPoints(taxable, taxRateBp);
}
