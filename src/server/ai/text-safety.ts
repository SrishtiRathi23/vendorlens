import "server-only";

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+/gi;
// Indian mobiles and landlines: +91 98765 43210, 098765-43210, 9876543210, (080) 2345 6789.
const PHONE = /(?:\+?91[\s-]?)?(?:\(?0?\d{2,4}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,6}\b/g;

/**
 * Replaces contact details with "[redacted]" before text is sent to the model. Quotes and briefs
 * often contain a vendor's phone or email; Gemini never needs them to understand prices.
 * Only digit runs of 10+ digits count as phone numbers, so prices such as 1,50,000 are kept.
 */
export function redactContactDetails(text: string): string {
  return text
    .replace(EMAIL, "[redacted]")
    .replace(URL_LIKE, "[redacted]")
    .replace(PHONE, (match) => (match.replace(/\D/g, "").length >= 10 ? "[redacted]" : match));
}

/** Removes links, emails and phone numbers from every string in model output, recursively. */
export function scrubOutput<T>(value: T): T {
  if (typeof value === "string") return redactContactDetails(value) as T;
  if (Array.isArray(value)) return value.map((item: unknown) => scrubOutput(item)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrubOutput(item)])) as T;
  }
  return value;
}
