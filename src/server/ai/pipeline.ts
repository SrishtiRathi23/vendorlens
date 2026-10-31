import "server-only";
import { ApiError } from "@/server/http/errors";
import type { AppConfig } from "@/server/http/env";
import { logEvent } from "@/server/http/log";
import { toGeminiSchema } from "@/server/ai/gemini-schema";
import { type GenerateFn, isRetryableModelError, toApiError } from "@/server/ai/model";
import { PROMPT_VERSION } from "@/server/ai/prompts";
import type { TaskSpec } from "@/server/ai/tasks";

const CALL_TIMEOUT_MS = 20_000;

export interface TaskResult<Res> {
  data: Res;
  model: string;
  repaired: boolean;
}

type Evaluation<Out> = { ok: true; output: Out } | { ok: false; problems: string[] };

function evaluate<Req, Out, Res>(spec: TaskSpec<Req, Out, Res>, text: string, request: Req): Evaluation<Out> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, problems: ["The answer was not valid JSON."] };
  }
  const parsed = spec.output.safeParse(json);
  if (!parsed.success) {
    const paths = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "(root)"))].slice(0, 8);
    return { ok: false, problems: [`Schema mismatch at: ${paths.join(", ")}`] };
  }
  const problems = spec.check(parsed.data, request);
  return problems.length === 0 ? { ok: true, output: parsed.data } : { ok: false, problems };
}

/**
 * Runs one AI task: structured call → JSON → Zod → rule checks → at most **one** repair attempt
 * (told only which rules failed) → typed result. If the primary model is out of quota or
 * unavailable, the fallback model is tried once. Nothing the model returns is used unvalidated.
 */
export async function runTask<Req, Out, Res>(
  spec: TaskSpec<Req, Out, Res>,
  request: Req,
  deps: { config: AppConfig; generate: GenerateFn },
): Promise<TaskResult<Res>> {
  if (deps.config.aiProvider === "fixture") {
    return { data: spec.finish(spec.output.parse(spec.fixture(request)), request), model: "fixture", repaired: false };
  }

  const models = [
    ...new Set([deps.config.geminiModel, deps.config.geminiFallbackModel].filter((m): m is string => Boolean(m))),
  ];
  const schema = toGeminiSchema(spec.output);

  const call = async (model: string, prompt: string): Promise<string> => {
    const started = Date.now();
    const { text, outputTokens } = await deps.generate({
      model,
      systemInstruction: spec.system,
      prompt,
      responseSchema: schema,
      maxOutputTokens: spec.maxOutputTokens,
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    logEvent("ai_call", {
      task: spec.name,
      model,
      promptVersion: PROMPT_VERSION,
      ms: Date.now() - started,
      outputTokens,
    });
    return text;
  };

  for (const [index, model] of models.entries()) {
    try {
      const prompt = spec.prompt(request);
      const first = evaluate(spec, await call(model, prompt), request);
      if (first.ok) return { data: spec.finish(first.output, request), model, repaired: false };

      // Problems hold rule ids and field paths only (never user or model text), so they are safe to log.
      logEvent("ai_repair", { task: spec.name, model, problems: first.problems.join("; ").slice(0, 300) });
      const repairPrompt = `${prompt}\n\nYour previous answer was rejected for these reasons:\n- ${first.problems.join("\n- ")}\nReturn a corrected answer.`;
      const second = evaluate(spec, await call(model, repairPrompt), request);
      if (second.ok) return { data: spec.finish(second.output, request), model, repaired: true };
      throw new ApiError("OUTPUT_INVALID");
    } catch (error) {
      const hasFallback = index < models.length - 1;
      if (hasFallback && isRetryableModelError(error)) {
        logEvent("ai_fallback", { task: spec.name, from: model });
        continue;
      }
      throw toApiError(error);
    }
  }
  throw new ApiError("AI_DISABLED"); // no model configured
}
