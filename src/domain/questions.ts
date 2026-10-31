import type { NormalizedQuote } from "@/domain/quote-normalize";
import type { Quote } from "@/domain/schemas";

const FIELD_QUESTIONS: Record<string, string> = {
  "terms.tax": "Is GST included in this price? If not, which rate applies and to which items?",
  "terms.transport": "Is transport or delivery included? If not, what exactly will it cost?",
  "terms.staffing": "Are service staff included? If not, how many staff and at what charge?",
  "terms.setup": "Is setup and clearing included, or is there a separate charge?",
};

/**
 * Questions to send the vendor, written by code from what is actually missing, so they exist
 * even when the AI is unavailable. Optional AI suggestions are appended after these.
 */
export function vendorQuestions(
  quote: Quote,
  normalized: NormalizedQuote,
  aiSuggestions: readonly string[] = [],
): string[] {
  const questions = normalized.unknowns.map(
    (unknown) => FIELD_QUESTIONS[unknown.field] ?? `${unknown.label} isn't stated. What will it cost?`,
  );
  for (const tag of normalized.missingTags)
    questions.push(`Does your offer include ${tag.toLowerCase()}? If not, what would it cost?`);
  for (const mismatch of normalized.mismatches) questions.push(`${mismatch} Could you send an updated quote?`);
  if (quote.terms.depositRefundable === "unknown" && quote.terms.paymentSchedule.length > 0) {
    questions.push("Is the advance refundable if we cancel? Up to which date?");
  }
  return [...new Set([...questions, ...aiSuggestions])];
}
