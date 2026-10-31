import "server-only";
import { ApiError } from "@/server/http/errors";

/**
 * Accepts browser requests from this app only. The `Origin` header must be present and match the
 * host the request was addressed to (Firebase Hosting forwards it as `x-forwarded-host`) or one of
 * the configured extra origins. Requests without an Origin header (scripts, curl) are refused.
 */
export function assertSameOrigin(request: Request, extraOrigins: readonly string[]): void {
  const origin = request.headers.get("origin");
  if (!origin || !URL.canParse(origin)) throw new ApiError("FORBIDDEN_ORIGIN");
  if (extraOrigins.includes(origin)) return;
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")].filter(Boolean);
  if (!hosts.includes(new URL(origin).host)) throw new ApiError("FORBIDDEN_ORIGIN");
}

/** Reads a JSON body no larger than `maxBytes`, checking both the declared and the actual size. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new ApiError("PAYLOAD_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new ApiError("PAYLOAD_TOO_LARGE");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("BAD_INPUT");
  }
}

/** The caller's address as seen by Cloud Run (first hop of `x-forwarded-for`). */
export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
