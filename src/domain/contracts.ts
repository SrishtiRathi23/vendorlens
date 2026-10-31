import { z } from "zod";
import {
  CategoryKeySchema,
  DietTagSchema,
  EventKindSchema,
  IdeaSectionSchema,
  isoDate,
  paise,
  PaymentWhenSchema,
  PrioritySchema,
  type Quote,
} from "@/domain/schemas";

/*
 * Contracts shared by the API routes and the browser. The `*Ai*` schemas describe what Gemini may
 * return. They contain no totals, no labels such as "confirmed", and no fields for business names,
 * URLs or contact details, so the model has nowhere to put them.
 */

/** Strict length check, for what users send. */
const text = (max: number) => z.string().max(max);
/** Model answers are clipped rather than rejected when a free-text field runs long. */
const aiText = (max: number) => z.string().transform((value) => value.slice(0, max));
/** Lists in model answers are trimmed to their maximum (minimums still apply) rather than rejected. */
const aiList = <T extends z.ZodType>(item: T, max: number, min = 0) =>
  z
    .array(item)
    .min(min)
    .transform((items) => items.slice(0, max));

// ---- Plan draft ---------------------------------------------------------------------------

/** What the browser sends to `/api/ai/draft`. Contacts and notes are never part of it. */
export const EventBriefSchema = z.object({
  kind: EventKindSchema,
  title: z.string().trim().min(2).max(100),
  date: isoDate,
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  city: z.string().trim().min(2).max(80),
  guestCount: z.number().int().min(1).max(100_000),
  budgetPaise: paise.min(100_000),
  contingencyBp: z.number().int().min(0).max(3_000),
  dietary: z.array(DietTagSchema).max(7),
  cultureNote: z.string().trim().max(300),
  mustHaves: z.array(z.string().trim().min(1).max(60)).max(8),
  brief: z.string().trim().max(1_500),
});

export const PlanDraftAiSchema = z.object({
  summary: aiText(400),
  categories: aiList(
    z.object({ key: CategoryKeySchema, weightBp: z.number().int().min(0).max(10_000), rationale: aiText(200) }),
    8,
    3,
  ),
  requirements: aiList(
    z.object({
      ref: aiText(4),
      category: CategoryKeySchema,
      label: aiText(80),
      required: z.boolean(),
      coverageTags: aiList(aiText(30), 8),
      why: aiText(200),
      questions: aiList(aiText(160), 5, 1),
      bookByLeadDays: z.number().int().min(0).max(730),
      priority: PrioritySchema,
    }),
    16,
    3,
  ),
  tasks: aiList(
    z.object({
      ref: aiText(4),
      title: aiText(100),
      category: CategoryKeySchema.nullable(),
      leadDays: z.number().int().min(0).max(730),
      priority: PrioritySchema,
      dependsOn: aiList(aiText(4), 4),
    }),
    30,
    4,
  ),
  ideas: aiList(
    z.object({
      section: IdeaSectionSchema,
      title: aiText(80),
      description: aiText(300),
      whyItFits: aiText(200),
      dietTags: aiList(DietTagSchema, 7),
    }),
    24,
    6,
  ),
  dayOf: aiList(
    z.object({
      startMinute: z.number().int().min(-720).max(1440),
      durationMinutes: z.number().int().min(5).max(600),
      title: aiText(80),
      ownerRole: aiText(40),
    }),
    20,
    3,
  ),
  assumptions: aiList(aiText(200), 6),
  openQuestions: aiList(aiText(200), 5),
});

// ---- Adjust ---------------------------------------------------------------------------------

export const ADJUST_SCOPES = ["plan", "budget", "vendors", "timeline", "ideas"] as const;
const AdjustScopeSchema = z.enum(ADJUST_SCOPES);

const ADJUST_OPS = [
  "set_guest_count",
  "set_event_date",
  "set_budget",
  "set_allocation",
  "add_requirement",
  "update_requirement",
  "remove_requirement",
  "add_task",
  "update_task",
  "remove_task",
  "add_idea",
  "remove_idea",
  "add_day_slot",
] as const;

/**
 * The model returns operations as one flat shape (simpler for structured output); code then
 * checks that each operation carries the fields its kind needs and drops anything else.
 */
const AdjustOperationAiSchema = z.object({
  op: z.enum(ADJUST_OPS),
  ref: aiText(4).nullable(),
  category: CategoryKeySchema.nullable(),
  number: z.number().nullable(),
  date: aiText(10).nullable(),
  title: aiText(120).nullable(),
  detail: aiText(300).nullable(),
  priority: PrioritySchema.nullable(),
  required: z.boolean().nullable(),
  coverageTags: aiList(aiText(30), 8).nullable(),
  section: IdeaSectionSchema.nullable(),
});

export const AdjustAiSchema = z.object({
  interpretation: aiText(300),
  operations: aiList(AdjustOperationAiSchema, 15),
  cannotDo: aiList(aiText(200), 6),
});

/** A compact, contact-free view of the plan with short refs (R1, T1, I1, D1) instead of ids. */
const AdjustContextSchema = z.object({
  kind: EventKindSchema,
  date: isoDate,
  guestCount: z.number().int().min(1).max(100_000),
  budgetRupees: z.number().int().min(0),
  dietary: z.array(DietTagSchema),
  allocations: z
    .array(z.object({ category: CategoryKeySchema, rupees: z.number().int().min(0), locked: z.boolean() }))
    .max(8),
  requirements: z
    .array(
      z.object({
        ref: text(4),
        category: CategoryKeySchema,
        label: text(80),
        required: z.boolean(),
        decided: z.boolean(),
      }),
    )
    .max(40),
  tasks: z
    .array(z.object({ ref: text(4), title: text(120), due: isoDate, priority: PrioritySchema, done: z.boolean() }))
    .max(60),
  ideas: z.array(z.object({ ref: text(4), section: IdeaSectionSchema, title: text(80) })).max(40),
  dayOf: z.array(z.object({ ref: text(4), title: text(80) })).max(30),
});

export const AdjustRequestSchema = z.object({
  instruction: z.string().trim().min(3).max(500),
  scope: AdjustScopeSchema,
  context: AdjustContextSchema,
});

// ---- Extract --------------------------------------------------------------------------------

const evidence = aiText(300);
const costTermAi = z.object({
  state: z.enum(["included", "not_applicable", "unknown", "amount"]),
  rupees: z.number().min(0).nullable(),
  evidence,
});

export const ExtractionAiSchema = z.object({
  currency: aiText(10),
  vendorAlias: z.object({ value: aiText(80).nullable(), evidence }),
  lines: aiList(
    z.object({
      description: aiText(120),
      basis: z.enum(["flat", "per_guest", "per_hour", "per_unit"]),
      unitRupees: z.number().min(0).nullable(),
      quantity: z.number().int().min(0).nullable(),
      evidence,
    }),
    30,
  ),
  inclusions: aiList(z.object({ tag: aiText(30), evidence }), 20),
  exclusions: aiList(z.object({ text: aiText(160), evidence }), 20),
  tax: z.object({
    mode: z.enum(["included", "exclusive_known", "exclusive_unknown", "unknown"]),
    ratePercent: z.number().min(0).max(50).nullable(),
    statedRupees: z.number().min(0).nullable(),
    evidence,
  }),
  transport: costTermAi,
  staffing: costTermAi,
  setup: costTermAi,
  paymentSchedule: aiList(
    z.object({
      percent: z.number().min(0).max(100),
      when: PaymentWhenSchema,
      days: z.number().int().min(0).max(365).nullable(),
      evidence,
    }),
    6,
  ),
  depositRefundable: z.object({ value: z.enum(["yes", "no", "unknown"]), evidence }),
  cancellation: z.object({ value: aiText(400).nullable(), evidence }),
  validUntil: z.object({ value: aiText(40).nullable(), evidence }),
  guestCountAssumed: z.object({ value: z.number().int().min(1).nullable(), evidence }),
  suggestedQuestions: aiList(aiText(200), 3),
});

export const ExtractRequestSchema = z.object({
  quoteText: z.string().trim().min(20).max(10_000),
  category: CategoryKeySchema,
  guestCount: z.number().int().min(1).max(100_000),
});

// ---- API envelope ---------------------------------------------------------------------------

/** Every failure the API can report; the server maps each to a fixed status and message. */
export type ApiErrorCode =
  | "BAD_INPUT"
  | "PAYLOAD_TOO_LARGE"
  | "FORBIDDEN_ORIGIN"
  | "RATE_LIMITED"
  | "AI_DISABLED"
  | "MODEL_UNAVAILABLE"
  | "OUTPUT_INVALID"
  | "TIMEOUT"
  | "UNSUPPORTED_CURRENCY";

export type ApiResult<T> =
  | { ok: true; data: T; meta: { model: string; cached: boolean; repaired: boolean } }
  | { ok: false; error: { code: ApiErrorCode; message: string; retryAfterSeconds?: number } };

/** `/api/ai/draft` answer: the validated draft plus soft-rule notes that never block the plan. */
export interface DraftResponse {
  draft: PlanDraftAi;
  notes: string[];
}

/** `/api/ai/extract` answer: an evidence-checked, still unconfirmed quote. */
export interface ExtractResponse {
  quote: Quote;
}

export type EventBrief = z.infer<typeof EventBriefSchema>;
export type PlanDraftAi = z.infer<typeof PlanDraftAiSchema>;
export type AdjustScope = z.infer<typeof AdjustScopeSchema>;
export type AdjustOperationAi = z.infer<typeof AdjustOperationAiSchema>;
export type AdjustAi = z.infer<typeof AdjustAiSchema>;
export type AdjustContext = z.infer<typeof AdjustContextSchema>;
export type AdjustRequest = z.infer<typeof AdjustRequestSchema>;
export type ExtractionAi = z.infer<typeof ExtractionAiSchema>;
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;
