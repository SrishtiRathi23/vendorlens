import { describe, expect, it, vi } from "vitest";
import type { ApiResult, DraftResponse } from "@/domain/contracts";
import { SAMPLE_BRIEFS } from "@/domain/samples";
import { ResponseCache } from "@/server/ai/cache";
import { type HandlerDeps, handleAiRequest } from "@/server/ai/handler";
import { draftTask } from "@/server/ai/tasks";
import { RateLimiter } from "@/server/http/rate-limit";
import { TODAY } from "../helpers/factories";

const fixtureEnv = { NODE_ENV: "test", AI_ENABLED: "true", AI_PROVIDER: "fixture" };

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    env: fixtureEnv,
    limiter: new RateLimiter(),
    cache: new ResponseCache(),
    generateFor: vi.fn(),
    ...overrides,
  };
}

const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://vendorlens.test/api/ai/draft", {
    method: "POST",
    headers: {
      origin: "https://vendorlens.test",
      host: "vendorlens.test",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function call(body: unknown, d: HandlerDeps, headers?: Record<string, string>) {
  const response = await handleAiRequest(draftTask, request(body, headers), d);
  return {
    status: response.status,
    body: (await response.json()) as ApiResult<DraftResponse>,
    headers: response.headers,
  };
}

const brief = SAMPLE_BRIEFS.birthday(TODAY);

describe("POST /api/ai/* handler", () => {
  it("returns a validated draft and serves a repeat request from the cache", async () => {
    const d = deps();
    const first = await call(brief, d);
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(first.body).toMatchObject({ ok: true, meta: { model: "fixture", cached: false } });
    expect((await call(brief, d)).body).toMatchObject({ ok: true, meta: { cached: true } });
  });

  it.each([
    ["403 for another origin", { origin: "https://evil.example" }, brief, 403, "FORBIDDEN_ORIGIN"],
    ["400 for an invalid brief", {}, { ...brief, guestCount: -3 }, 400, "BAD_INPUT"],
    ["413 for an oversized body", {}, { ...brief, brief: "x".repeat(20_000) }, 413, "PAYLOAD_TOO_LARGE"],
  ])("%s", async (_label, headers, body, status, code) => {
    const result = await call(body, deps(), headers);
    expect(result.status).toBe(status);
    expect(result.body).toMatchObject({ ok: false, error: { code } });
  });

  it("503 with a clear code when AI is switched off or misconfigured", async () => {
    expect((await call(brief, deps({ env: { AI_ENABLED: "false" } }))).body).toMatchObject({
      error: { code: "AI_DISABLED" },
    });
    expect((await call(brief, deps({ env: { AI_ENABLED: "true" } }))).status).toBe(503);
  });

  it("429 with Retry-After once the caller exceeds the limit", async () => {
    const d = deps({ limiter: new RateLimiter({ perClientPerMinute: 1, perClientPerDay: 10, globalPerDay: 10 }) });
    await call(brief, d);
    const limited = await call(brief, d);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(limited.body).toMatchObject({ ok: false, error: { code: "RATE_LIMITED", retryAfterSeconds: 60 } });
  });

  it("never echoes request text or internal details in an error", async () => {
    const result = await call({ ...brief, brief: "secret family detail", guestCount: 0 }, deps());
    expect(JSON.stringify(result.body)).not.toContain("secret family detail");
  });
});
