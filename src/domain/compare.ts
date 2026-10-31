import { formatINR } from "@/domain/money";
import type { NormalizedQuote } from "@/domain/quote-normalize";

export interface Comparison {
  quotes: NormalizedQuote[];
  /** Set only when there are two or more quotes and **every one** is comparable. */
  lowestKnownTotalId: string | null;
  verdict: string;
}

/**
 * Ranks nothing it cannot justify: a "lowest known total" is named only when every quote in the
 * view is complete and current. Otherwise the verdict says exactly what is in the way.
 */
export function compareQuotes(quotes: readonly NormalizedQuote[]): Comparison {
  const list = [...quotes];
  if (list.length < 2) {
    return { quotes: list, lowestKnownTotalId: null, verdict: "Add at least two confirmed quotes to compare." };
  }
  const blockers = list.filter((quote) => quote.status !== "comparable");
  if (blockers.length > 0) {
    const names = blockers.map((quote) => quote.vendorAlias).join(", ");
    return {
      quotes: list,
      lowestKnownTotalId: null,
      verdict: `No winner yet: ${names} ${blockers.length === 1 ? "has" : "have"} unknown or mismatched terms. Ask the questions below first.`,
    };
  }
  const lowest = list.reduce((best, quote) => (quote.knownTotalPaise < best.knownTotalPaise ? quote : best));
  const next = list.filter((quote) => quote !== lowest).sort((a, b) => a.knownTotalPaise - b.knownTotalPaise)[0];
  const gap = next ? next.knownTotalPaise - lowest.knownTotalPaise : 0;
  return {
    quotes: list,
    lowestKnownTotalId: lowest.quoteId,
    verdict: `${lowest.vendorAlias} has the lowest known total, ${formatINR(gap)} below the next offer, with every required item covered.`,
  };
}
