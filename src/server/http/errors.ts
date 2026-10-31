import "server-only";
import type { ApiErrorCode, ApiResult } from "@/domain/contracts";

const STATUS: Record<ApiErrorCode, number> = {
  BAD_INPUT: 400,
  PAYLOAD_TOO_LARGE: 413,
  FORBIDDEN_ORIGIN: 403,
  RATE_LIMITED: 429,
  AI_DISABLED: 503,
  MODEL_UNAVAILABLE: 503,
  OUTPUT_INVALID: 502,
  TIMEOUT: 504,
  UNSUPPORTED_CURRENCY: 422,
};

const MESSAGE: Record<ApiErrorCode, string> = {
  BAD_INPUT: "Some of the details sent were missing or invalid.",
  PAYLOAD_TOO_LARGE: "That's more text than VendorLens accepts in one request.",
  FORBIDDEN_ORIGIN: "Requests are only accepted from the VendorLens app itself.",
  RATE_LIMITED: "Too many AI requests right now. Please wait a moment and try again.",
  AI_DISABLED: "AI features are switched off. Everything else still works.",
  MODEL_UNAVAILABLE: "The AI service is busy or unavailable. Please try again shortly.",
  OUTPUT_INVALID: "The AI's answer didn't pass our checks, so it wasn't used.",
  TIMEOUT: "The AI took too long to answer.",
  UNSUPPORTED_CURRENCY: "Only quotes in Indian rupees can be compared.",
};

/** A failure the API reports to the browser with a fixed, non-revealing message. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: ApiErrorCode, retryAfterSeconds?: number) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function errorResponse(error: ApiError): Response {
  const body: ApiResult<never> = {
    ok: false,
    error: {
      code: error.code,
      message: MESSAGE[error.code],
      ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    },
  };
  const headers = error.retryAfterSeconds ? { ...NO_STORE, "Retry-After": String(error.retryAfterSeconds) } : NO_STORE;
  return Response.json(body, { status: STATUS[error.code], headers });
}

export function okResponse(data: unknown, meta: { model: string; cached: boolean; repaired: boolean }): Response {
  const body: ApiResult<unknown> = { ok: true, data, meta };
  return Response.json(body, { headers: NO_STORE });
}
