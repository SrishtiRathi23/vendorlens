import "server-only";
import { z } from "zod";

/**
 * JSON Schema keywords removed from the copy Gemini sees. Vertex AI rejects requests that carry
 * numeric and length bounds (measured 31 Oct 2026: HTTP 400 with them, 200 without). The bounds
 * are not lost: the full Zod schema still enforces every one of them on the answer.
 */
const UNSUPPORTED = new Set([
  "$schema",
  "$id",
  "$ref",
  "$defs",
  "pattern",
  "format",
  "additionalProperties",
  "propertyNames",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
]);

function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip);
  if (node === null || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !UNSUPPORTED.has(key))
      .map(([key, value]) => [key, strip(value)]),
  );
}

/**
 * The response schema given to Gemini, generated from the same Zod schema that validates the
 * answer, so the contract the model sees and the check we run can't drift apart.
 */
export function toGeminiSchema(schema: z.ZodType): unknown {
  // "input" describes what the model must send (clipping transforms run afterwards, on our side).
  return strip(z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any", io: "input" }));
}
