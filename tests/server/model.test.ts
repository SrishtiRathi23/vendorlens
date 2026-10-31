import type * as genai from "@google/genai";
import { ApiError as GenAiError } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerate, isRetryableModelError, toApiError } from "@/server/ai/model";
import { readConfig } from "@/server/http/env";
import { ApiError } from "@/server/http/errors";
import { RateLimiter } from "@/server/http/rate-limit";

const generateContent = vi.fn();
const constructed: unknown[] = [];

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof genai>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent };
      constructor(options: unknown) {
        constructed.push(options);
      }
    },
  };
});

beforeEach(() => {
  generateContent.mockReset();
  constructed.length = 0;
});

const request = {
  model: "m",
  systemInstruction: "sys",
  prompt: "hi",
  responseSchema: { type: "object" },
  maxOutputTokens: 100,
  signal: new AbortController().signal,
};

describe("createGenerate", () => {
  it("uses keyless Vertex AI with structured JSON output", async () => {
    generateContent.mockResolvedValue({ text: '{"ok":true}', usageMetadata: { candidatesTokenCount: 7 } });
    const config = readConfig({
      AI_ENABLED: "true",
      GEMINI_MODEL: "m",
      GOOGLE_CLOUD_PROJECT: "proj",
      GOOGLE_CLOUD_LOCATION: "global",
    });
    const result = await createGenerate(config)(request);

    expect(result).toEqual({ text: '{"ok":true}', outputTokens: 7 });
    expect(constructed[0]).toEqual({ enterprise: true, project: "proj", location: "global" });
    const call = generateContent.mock.calls[0]?.[0] as { config: Record<string, unknown> };
    expect(call.config).toMatchObject({
      systemInstruction: "sys",
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object" },
      maxOutputTokens: 100,
    });
  });

  it("uses the Developer API key only when that provider is chosen, and tolerates empty answers", async () => {
    generateContent.mockResolvedValue({});
    const config = readConfig({
      AI_ENABLED: "true",
      AI_PROVIDER: "developer",
      GEMINI_MODEL: "m",
      GEMINI_API_KEY: "test-key",
    });
    expect(await createGenerate(config)(request)).toEqual({ text: "", outputTokens: 0 });
    expect(constructed[0]).toEqual({ apiKey: "test-key" });
  });
});

describe("model error mapping", () => {
  it("retries only on quota, overload and missing-model errors", () => {
    expect(isRetryableModelError(new GenAiError({ message: "x", status: 503 }))).toBe(true);
    expect(isRetryableModelError(new GenAiError({ message: "x", status: 400 }))).toBe(false);
    expect(isRetryableModelError(new Error("x"))).toBe(false);
  });

  it("maps failures to fixed API codes", () => {
    expect(toApiError(new ApiError("BAD_INPUT")).code).toBe("BAD_INPUT");
    expect(toApiError(Object.assign(new Error("t"), { name: "AbortError" })).code).toBe("TIMEOUT");
    expect(toApiError(new GenAiError({ message: "x", status: 500 })).code).toBe("MODEL_UNAVAILABLE");
  });
});

describe("rate limiter housekeeping", () => {
  it("forgets day-old windows once it tracks many callers", () => {
    const limiter = new RateLimiter({ perClientPerMinute: 1, perClientPerDay: 1, globalPerDay: 100_000 });
    for (let i = 0; i < 5_001; i++) limiter.take(`client-${String(i)}`, 0);
    expect(limiter.take("client-0", 90_000_000)).toBeNull(); // a day later, old windows were pruned
  });
});
