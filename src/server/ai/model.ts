import "server-only";
import { ApiError as GenAiError, GoogleGenAI } from "@google/genai";
import { ApiError } from "@/server/http/errors";
import type { AppConfig } from "@/server/http/env";

interface GenerateRequest {
  model: string;
  systemInstruction: string;
  prompt: string;
  responseSchema: unknown;
  maxOutputTokens: number;
  signal: AbortSignal;
}

/** One structured-output call. Returns the raw JSON text; parsing and validation happen upstream. */
export type GenerateFn = (request: GenerateRequest) => Promise<{ text: string; outputTokens: number }>;

/**
 * Builds the Gemini caller for the configured provider. Vertex AI uses Application Default
 * Credentials (the Cloud Run service account), so no key is read; the Developer API path reads
 * its key from the environment, which is filled from Secret Manager in production.
 */
export function createGenerate(config: AppConfig): GenerateFn {
  const client =
    config.aiProvider === "developer"
      ? new GoogleGenAI({ apiKey: config.geminiApiKey ?? "" })
      : new GoogleGenAI({ enterprise: true, project: config.gcpProject ?? "", location: config.gcpLocation });

  return async ({ model, systemInstruction, prompt, responseSchema, maxOutputTokens, signal }) => {
    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema,
        temperature: 0.4,
        maxOutputTokens,
        abortSignal: signal,
        labels: { app: "vendorlens" },
      },
    });
    return { text: response.text ?? "", outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0 };
  };
}

/** True when another model might succeed where this one failed (quota, overload, missing model). */
export function isRetryableModelError(error: unknown): boolean {
  return error instanceof GenAiError && [404, 429, 500, 503].includes(error.status);
}

/** Maps SDK and network failures to the API's fixed error codes, keeping provider details private. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
    return new ApiError("TIMEOUT");
  if (error instanceof GenAiError && error.status === 429) return new ApiError("MODEL_UNAVAILABLE", 30);
  return new ApiError("MODEL_UNAVAILABLE");
}
