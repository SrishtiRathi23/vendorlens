import type {
  AdjustAi,
  AdjustRequest,
  ApiResult,
  DraftResponse,
  EventBrief,
  ExtractRequest,
  ExtractResponse,
} from "@/domain/contracts";

const CLIENT_TIMEOUT_MS = 25_000;

async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
    return (await response.json()) as ApiResult<T>;
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut
        ? { code: "TIMEOUT", message: "The AI took too long to answer." }
        : { code: "MODEL_UNAVAILABLE", message: "Couldn't reach VendorLens. Check your connection and try again." },
    };
  }
}

/** The only three calls the browser makes to the server, each started by an explicit button. */
export const ai = {
  draft: (brief: EventBrief) => post<DraftResponse>("/api/ai/draft", brief),
  adjust: (request: AdjustRequest) => post<AdjustAi>("/api/ai/adjust", request),
  extract: (request: ExtractRequest) => post<ExtractResponse>("/api/ai/extract", request),
};
