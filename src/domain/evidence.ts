import { numberAppearsIn } from "@/domain/numbers";
import type { Provenance } from "@/domain/schemas";

/** Folds the differences that don't change meaning: Unicode forms, case, quotes, dashes and spacing. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[​-‍﻿]/g, "")
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Is `excerpt` really part of `source`? Exact text after normalisation only: no fuzzy matching,
 * so an excerpt the model invented or paraphrased is never reported as found.
 */
export function verifyEvidence(source: string, excerpt: string | null | undefined): boolean {
  if (!excerpt) return false;
  const needle = normalizeForMatch(excerpt);
  return needle.length >= 3 && normalizeForMatch(source).includes(needle);
}

/**
 * Provenance for one extracted field: `matched` only if the excerpt is in the source **and** every
 * number the model reported for the field is written in that excerpt.
 */
export function provenanceFor(
  source: string,
  excerpt: string | null | undefined,
  numbers: readonly number[] = [],
): Provenance {
  if (!verifyEvidence(source, excerpt)) return "not_found";
  return numbers.every((value) => numberAppearsIn(value, excerpt ?? "")) ? "matched" : "not_found";
}
