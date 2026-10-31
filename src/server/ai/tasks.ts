import "server-only";
import type { z } from "zod";
import { CATEGORY_LABEL, COVERAGE_TAGS, REQUIRED_CATEGORIES } from "@/domain/categories";
import {
  type AdjustAi,
  AdjustAiSchema,
  type AdjustRequest,
  type DraftResponse,
  AdjustRequestSchema,
  type EventBrief,
  EventBriefSchema,
  type ExtractionAi,
  type ExtractResponse,
  ExtractionAiSchema,
  type ExtractRequest,
  ExtractRequestSchema,
  type PlanDraftAi,
  PlanDraftAiSchema,
} from "@/domain/contracts";
import { isRupeeCurrency, quoteFromExtraction } from "@/domain/extraction";
import { randomId } from "@/domain/ids";
import { formatINR } from "@/domain/money";
import { PlanError, topologicalOrder } from "@/domain/plan-build";
import { TEMPLATE_DRAFTS } from "@/domain/templates";
import { ApiError } from "@/server/http/errors";
import { ADJUST_SYSTEM, DRAFT_SYSTEM, EXTRACT_SYSTEM, wrap } from "@/server/ai/prompts";
import { redactContactDetails, scrubOutput } from "@/server/ai/text-safety";

/** Everything the pipeline needs to run one kind of AI request safely. */
export interface TaskSpec<Req, Out, Res> {
  name: "draft" | "adjust" | "extract";
  maxBodyBytes: number;
  maxOutputTokens: number;
  request: z.ZodType<Req>;
  output: z.ZodType<Out>;
  system: string;
  prompt: (request: Req) => string;
  /** Hard rule failures (rule ids with a reason). Any failure triggers one repair, then an error. */
  check: (output: Out, request: Req) => string[];
  /** Turns a validated answer into the API response. */
  finish: (output: Out, request: Req) => Res;
  /** Recorded answer used when `AI_PROVIDER=fixture` (tests only). */
  fixture: (request: Req) => Out;
}

// ---- draft --------------------------------------------------------------------------------

function draftHardRules(draft: PlanDraftAi, brief: EventBrief): string[] {
  const problems: string[] = [];
  const reqRefs = draft.requirements.map((r) => r.ref);
  const taskRefs = draft.tasks.map((t) => t.ref);
  if (new Set(reqRefs).size !== reqRefs.length || new Set(taskRefs).size !== taskRefs.length)
    problems.push("D1: refs must be unique");
  if (draft.tasks.some((t) => t.dependsOn.some((dep) => !taskRefs.includes(dep))))
    problems.push("D2: dependsOn must use existing task refs");
  try {
    topologicalOrder(draft.tasks);
  } catch (error) {
    if (!(error instanceof PlanError)) throw error;
    problems.push("D2: task dependencies contain a cycle");
  }
  const funded = new Set(draft.categories.filter((c) => c.weightBp > 0).map((c) => c.key));
  if (funded.size < 3) problems.push("D3: give a positive weight to at least three categories");
  const missing = REQUIRED_CATEGORIES[brief.kind].filter((key) => !funded.has(key));
  if (missing.length > 0) problems.push(`D4: a ${brief.kind} must fund ${missing.join(", ")}`);
  return problems;
}

function draftNotes(draft: PlanDraftAi, brief: EventBrief): string[] {
  const notes: string[] = [];
  const menuTags = new Set(draft.ideas.filter((i) => i.section === "menu").flatMap((i) => i.dietTags));
  const uncovered = brief.dietary.filter((tag) => !menuTags.has(tag));
  if (uncovered.length > 0)
    notes.push(`No menu idea is marked ${uncovered.join(", ").replace(/_/g, "-")}; check the menu with your caterer.`);
  for (const section of ["accessibility", "sustainability"] as const) {
    if (!draft.ideas.some((i) => i.section === section))
      notes.push(`No ${section} idea was suggested; consider adding one.`);
  }
  return notes;
}

const rupeeBand = (paise: number) => formatINR(Math.max(10_000, Math.round(paise / 1_000_000) * 10_000) * 100);

export const draftTask: TaskSpec<EventBrief, PlanDraftAi, DraftResponse> = {
  name: "draft",
  maxBodyBytes: 16_000,
  maxOutputTokens: 6_000,
  request: EventBriefSchema,
  output: PlanDraftAiSchema,
  system: DRAFT_SYSTEM,
  prompt: (brief) =>
    [
      `Event type: ${brief.kind}`,
      `Date: ${brief.date} (start ${brief.startTime}, India)`,
      `Area: ${redactContactDetails(brief.city)}`,
      `Guests: ${String(brief.guestCount)}`,
      `Budget: about ${rupeeBand(brief.budgetPaise)} (contingency held separately)`,
      `Dietary needs: ${brief.dietary.join(", ") || "none stated"}`,
      `Must-haves: ${brief.mustHaves.map(redactContactDetails).join("; ") || "none stated"}`,
      wrap("user_brief", redactContactDetails([brief.cultureNote, brief.brief].filter(Boolean).join("\n"))),
    ].join("\n"),
  check: draftHardRules,
  finish: (draft, brief) => ({ draft: scrubOutput(draft), notes: draftNotes(draft, brief) }),
  fixture: (brief) => TEMPLATE_DRAFTS[brief.kind],
};

// ---- adjust -------------------------------------------------------------------------------

export const adjustTask: TaskSpec<AdjustRequest, AdjustAi, AdjustAi> = {
  name: "adjust",
  maxBodyBytes: 24_000,
  maxOutputTokens: 2_000,
  request: AdjustRequestSchema,
  output: AdjustAiSchema,
  system: ADJUST_SYSTEM,
  prompt: ({ scope, context, instruction }) =>
    [
      `Scope: ${scope}`,
      `Current plan (JSON): ${JSON.stringify(context)}`,
      wrap("user_request", redactContactDetails(instruction)),
    ].join("\n"),
  check: () => [],
  finish: (answer, { context }) => {
    const known = new Set(
      [...context.requirements, ...context.tasks, ...context.ideas, ...context.dayOf].map((item) => item.ref),
    );
    const operations = answer.operations.filter((op) => op.ref === null || known.has(op.ref));
    const dropped = answer.operations.length - operations.length;
    const cannotDo =
      dropped > 0
        ? [...answer.cannotDo, `Ignored ${String(dropped)} change(s) that referred to items not in your plan.`]
        : answer.cannotDo;
    return scrubOutput({ interpretation: answer.interpretation, operations, cannotDo });
  },
  fixture: ({ scope }) => ({
    interpretation: "Add an idea to the plan.",
    operations: [
      {
        op: "add_idea",
        ref: null,
        category: null,
        number: null,
        date: null,
        title: "Welcome drink counter",
        detail: "Seasonal coolers as guests arrive.",
        priority: null,
        required: null,
        coverageTags: null,
        section: "menu",
      },
    ],
    cannotDo: scope === "plan" ? [] : ["Only changes inside the chosen scope were considered."],
  }),
};

// ---- extract ------------------------------------------------------------------------------

export const extractTask: TaskSpec<ExtractRequest, ExtractionAi, ExtractResponse> = {
  name: "extract",
  maxBodyBytes: 24_000,
  maxOutputTokens: 4_000,
  request: ExtractRequestSchema,
  output: ExtractionAiSchema,
  system: EXTRACT_SYSTEM,
  prompt: ({ category, guestCount, quoteText }) =>
    [
      `Category: ${CATEGORY_LABEL[category]} (${category})`,
      `Allowed inclusion tags: ${COVERAGE_TAGS[category].join(", ")}`,
      `The organiser's event has ${String(guestCount)} guests.`,
      wrap("quote_text", redactContactDetails(quoteText)),
    ].join("\n"),
  check: () => [],
  finish: (extraction, { category, quoteText }) => {
    if (!isRupeeCurrency(extraction.currency)) throw new ApiError("UNSUPPORTED_CURRENCY");
    const quote = quoteFromExtraction(scrubOutput(extraction), {
      sourceText: redactContactDetails(quoteText),
      category,
      newId: randomId,
    });
    return { quote };
  },
  fixture: () => fixtureExtraction,
};

/** Recorded extraction of the sample "offer A" quote, for tests and offline development. */
const fixtureExtraction: ExtractionAi = {
  currency: "INR",
  vendorAlias: { value: "Shubh Rasoi Caterers (sample)", evidence: "Shubh Rasoi Caterers (sample)" },
  lines: [
    {
      description: "Wedding dinner per plate",
      basis: "per_guest",
      unitRupees: 850,
      quantity: null,
      evidence: "Rs. 850/- per plate",
    },
  ],
  inclusions: [{ tag: "crockery", evidence: "Crockery and buffet counters included." }],
  exclusions: [{ text: "Transport extra", evidence: "Transport extra as applicable." }],
  tax: { mode: "exclusive_unknown", ratePercent: null, statedRupees: null, evidence: "Taxes as applicable." },
  transport: { state: "unknown", rupees: null, evidence: "Transport extra as applicable." },
  staffing: { state: "unknown", rupees: null, evidence: "Service staff on actuals." },
  setup: { state: "unknown", rupees: null, evidence: "" },
  paymentSchedule: [
    { percent: 50, when: "on_booking", days: null, evidence: "50% advance to confirm the booking" },
    { percent: 50, when: "event_day", days: null, evidence: "balance on the event day" },
  ],
  depositRefundable: { value: "unknown", evidence: "" },
  cancellation: { value: null, evidence: "" },
  validUntil: { value: null, evidence: "Quote valid till 30 November." },
  guestCountAssumed: { value: 100, evidence: "minimum 100 plates" },
  suggestedQuestions: ["How many service staff are included, and what does each extra one cost?"],
};
