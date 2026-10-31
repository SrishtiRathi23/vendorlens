import { ApiError as GenAiError } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { adjustContext } from "@/domain/adjust";
import { sequentialIds } from "@/domain/ids";
import { SAMPLE_BRIEFS, SAMPLE_QUOTE_TEXTS, buildSampleEvent } from "@/domain/samples";
import { TEMPLATE_DRAFTS } from "@/domain/templates";
import { toGeminiSchema } from "@/server/ai/gemini-schema";
import type { GenerateFn } from "@/server/ai/model";
import { runTask } from "@/server/ai/pipeline";
import { adjustTask, draftTask, extractTask } from "@/server/ai/tasks";
import { readConfig } from "@/server/http/env";
import { ApiError } from "@/server/http/errors";
import { TODAY } from "../helpers/factories";

const config = readConfig({
  AI_ENABLED: "true",
  GEMINI_MODEL: "primary",
  GEMINI_FALLBACK_MODEL: "fallback",
  GOOGLE_CLOUD_PROJECT: "p",
});
const brief = SAMPLE_BRIEFS.wedding(TODAY);
const reply = (value: unknown) => ({
  text: typeof value === "string" ? value : JSON.stringify(value),
  outputTokens: 10,
});

function scripted(...answers: unknown[]) {
  const fn = vi.fn<GenerateFn>();
  for (const answer of answers) {
    if (answer instanceof Error) fn.mockRejectedValueOnce(answer);
    else fn.mockResolvedValueOnce(reply(answer));
  }
  return fn;
}

function firstOf<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error("expected at least one item");
  return item;
}

describe("runTask", () => {
  it("returns a validated draft and sends the user's text inside delimiters, without contact details", async () => {
    const generate = scripted(TEMPLATE_DRAFTS.wedding);
    const withContacts = { ...brief, brief: "Call me on +91 98765 43210 or mail a@b.com about the sangeet." };
    const result = await runTask(draftTask, withContacts, { config, generate });

    expect(result).toMatchObject({ model: "primary", repaired: false });
    expect(result.data.draft.categories).toHaveLength(8);
    const sent = generate.mock.calls[0]?.[0];
    expect(sent?.prompt).toContain("<user_brief>");
    expect(sent?.prompt).not.toContain("98765");
    expect(sent?.prompt).not.toContain("a@b.com");
    expect(sent?.prompt).toContain("about ₹15,00,000");
  });

  it("Q12 · repairs once when the answer isn't valid JSON, telling the model only what failed", async () => {
    const generate = scripted("not json", TEMPLATE_DRAFTS.wedding);
    const result = await runTask(draftTask, brief, { config, generate });
    expect(result.repaired).toBe(true);
    expect(generate.mock.calls[1]?.[0].prompt).toContain("not valid JSON");
  });

  it("Q12 · rejects an answer that still breaks the rules after one repair", async () => {
    const cyclic = structuredClone(TEMPLATE_DRAFTS.wedding);
    const [first, second] = cyclic.tasks;
    if (!first || !second) throw new Error("template needs two tasks");
    first.dependsOn = [second.ref];
    second.dependsOn = [first.ref];
    const generate = scripted(cyclic, cyclic);
    await expect(runTask(draftTask, brief, { config, generate })).rejects.toMatchObject({ code: "OUTPUT_INVALID" });
    expect(generate.mock.calls[1]?.[0].prompt).toContain("D2: task dependencies contain a cycle");
  });

  it("enforces the hard draft rules: unique refs, funded categories, required categories", () => {
    const broken = structuredClone(TEMPLATE_DRAFTS.wedding);
    broken.categories = broken.categories.map((c) =>
      c.key === "venue" || c.key === "catering" ? { ...c, weightBp: 0 } : c,
    );
    broken.requirements.push({ ...firstOf(broken.requirements) });
    firstOf(broken.tasks).dependsOn = ["T99"];
    const failures = draftTask.check(broken, brief);
    expect(failures.map((f) => f.slice(0, 2))).toEqual(["D1", "D2", "D4"]);
    expect(draftTask.check({ ...broken, categories: broken.categories.slice(0, 2) }, brief)).toContainEqual(
      expect.stringContaining("D3"),
    );
  });

  it("notes uncovered dietary needs without blocking the plan", () => {
    const draft = {
      ...TEMPLATE_DRAFTS.wedding,
      ideas: TEMPLATE_DRAFTS.wedding.ideas.filter((i) => i.section !== "sustainability"),
    };
    const { notes } = draftTask.finish(draft, brief);
    expect(notes).toEqual([expect.stringContaining("jain"), expect.stringContaining("sustainability")]);
  });

  it("falls back to the second model once when the first is out of quota", async () => {
    const generate = scripted(new GenAiError({ message: "quota", status: 429 }), TEMPLATE_DRAFTS.wedding);
    const result = await runTask(draftTask, brief, { config, generate });
    expect(result.model).toBe("fallback");
    expect(generate.mock.calls.map((call) => call[0].model)).toEqual(["primary", "fallback"]);
  });

  it("Q12 · maps quota, timeout and unknown failures to typed errors", async () => {
    const single = { ...config, geminiFallbackModel: undefined };
    await expect(
      runTask(draftTask, brief, {
        config: single,
        generate: scripted(new GenAiError({ message: "quota", status: 429 })),
      }),
    ).rejects.toMatchObject({
      code: "MODEL_UNAVAILABLE",
      retryAfterSeconds: 30,
    });
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    await expect(runTask(draftTask, brief, { config: single, generate: scripted(timeout) })).rejects.toMatchObject({
      code: "TIMEOUT",
    });
    await expect(
      runTask(draftTask, brief, { config: single, generate: scripted(new Error("boom")) }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      runTask(draftTask, brief, { config: { ...single, geminiModel: undefined }, generate: scripted() }),
    ).rejects.toMatchObject({ code: "AI_DISABLED" });
  });

  it("Q11 · extraction refuses non-rupee quotes and verifies every excerpt against the pasted text", async () => {
    const request = { quoteText: SAMPLE_QUOTE_TEXTS.offerA, category: "catering" as const, guestCount: 150 };
    const fixture = extractTask.fixture(request);
    const ok = await runTask(extractTask, request, { config, generate: scripted(fixture) });
    expect(ok.data.quote.provenance["lines.0"]).toBe("matched");
    expect(ok.data.quote.confirmed).toBe(false);
    await expect(
      runTask(extractTask, request, { config, generate: scripted({ ...fixture, currency: "USD" }) }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CURRENCY" });
  });

  it("drops adjustment operations that refer to items not in the plan", async () => {
    const { context } = adjustContext(buildSampleEvent("birthday", TODAY, sequentialIds()));
    const answer = adjustTask.fixture({ instruction: "x", scope: "plan" as const, context });
    answer.operations.push({ ...firstOf(answer.operations), op: "remove_task", ref: "T99" });
    const result = await runTask(
      adjustTask,
      { instruction: "add a drink counter", scope: "plan" as const, context },
      { config, generate: scripted(answer) },
    );
    expect(result.data.operations).toHaveLength(1);
    expect(result.data.cannotDo.at(-1)).toContain("Ignored 1 change");
  });

  it("serves recorded answers with the fixture provider, without calling a model", async () => {
    const generate = scripted();
    const result = await runTask(draftTask, brief, { config: { ...config, aiProvider: "fixture" }, generate });
    expect(result.model).toBe("fixture");
    expect(generate).not.toHaveBeenCalled();
  });

  it("gives Gemini a schema without the bounds Vertex rejects; Zod still enforces them", () => {
    const schema = JSON.stringify(toGeminiSchema(draftTask.output));
    for (const keyword of ["maxLength", "maxItems", "minimum", "maximum", "$schema"])
      expect(schema).not.toContain(`"${keyword}"`);
    expect(draftTask.output.safeParse({ ...TEMPLATE_DRAFTS.wedding, categories: [] }).success).toBe(false);
  });
});
