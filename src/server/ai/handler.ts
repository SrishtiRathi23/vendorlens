import "server-only";
import { ResponseCache, cacheKey } from "@/server/ai/cache";
import { createGenerate, type GenerateFn } from "@/server/ai/model";
import { runTask, type TaskResult } from "@/server/ai/pipeline";
import { PROMPT_VERSION } from "@/server/ai/prompts";
import type { TaskSpec } from "@/server/ai/tasks";
import { type AppConfig, ConfigError, readConfig } from "@/server/http/env";
import { ApiError, errorResponse, okResponse } from "@/server/http/errors";
import { assertSameOrigin, clientKey, readJsonBody } from "@/server/http/guards";
import { logEvent } from "@/server/http/log";
import { RateLimiter } from "@/server/http/rate-limit";

export interface HandlerDeps {
  env: Readonly<Record<string, string | undefined>>;
  limiter: RateLimiter;
  cache: ResponseCache<TaskResult<unknown>>;
  generateFor: (config: AppConfig) => GenerateFn;
}

let sharedGenerate: { key: string; fn: GenerateFn } | undefined;

/** Reuses one SDK client per configuration instead of creating one per request. */
function generateFor(config: AppConfig): GenerateFn {
  const key = JSON.stringify([config.aiProvider, config.gcpProject, config.gcpLocation, Boolean(config.geminiApiKey)]);
  if (sharedGenerate?.key !== key) sharedGenerate = { key, fn: createGenerate(config) };
  return sharedGenerate.fn;
}

const defaults: HandlerDeps = { env: process.env, limiter: new RateLimiter(), cache: new ResponseCache(), generateFor };

/**
 * The single entry point for every `/api/ai/*` route, in a fixed order: configuration → same-origin
 * check → AI switch → rate limit → bounded body → schema validation → cache / in-flight dedupe →
 * validated model call. Every failure becomes a typed error with a fixed message.
 */
export async function handleAiRequest<Req, Out, Res>(
  spec: TaskSpec<Req, Out, Res>,
  request: Request,
  deps: HandlerDeps = defaults,
): Promise<Response> {
  const started = Date.now();
  try {
    let config: AppConfig;
    try {
      config = readConfig(deps.env);
    } catch (error) {
      if (error instanceof ConfigError) throw new ApiError("MODEL_UNAVAILABLE");
      throw error;
    }
    assertSameOrigin(request, config.extraOrigins);
    if (!config.aiEnabled) throw new ApiError("AI_DISABLED");

    const waitSeconds = deps.limiter.take(clientKey(request));
    if (waitSeconds !== null) throw new ApiError("RATE_LIMITED", waitSeconds);

    const parsed = spec.request.safeParse(await readJsonBody(request, spec.maxBodyBytes));
    if (!parsed.success) throw new ApiError("BAD_INPUT");

    const key = cacheKey(spec.name, config.aiProvider, config.geminiModel, PROMPT_VERSION, parsed.data);
    const { value, cached } = await deps.cache.getOrCreate(key, () =>
      runTask(spec, parsed.data, { config, generate: deps.generateFor(config) }),
    );
    logEvent("ai_request", {
      task: spec.name,
      outcome: "ok",
      cached,
      repaired: value.repaired,
      ms: Date.now() - started,
    });
    return okResponse(value.data, { model: value.model, cached, repaired: value.repaired });
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError("MODEL_UNAVAILABLE");
    logEvent("ai_request", { task: spec.name, outcome: apiError.code, ms: Date.now() - started });
    return errorResponse(apiError);
  }
}
