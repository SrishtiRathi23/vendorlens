import { z } from "zod";
import { CATEGORY_KEYS, DIET_TAGS, EVENT_KINDS, IDEA_SECTIONS, PRIORITIES } from "@/domain/categories";
import { isIsoDate } from "@/domain/dates";
import { MAX_PAISE } from "@/domain/money";

export const paise = z.number().int().min(0).max(MAX_PAISE);
export const isoDate = z.string().refine(isIsoDate, "Expected a YYYY-MM-DD date");
const shortText = (max: number) => z.string().trim().max(max);

export const CategoryKeySchema = z.enum(CATEGORY_KEYS);
export const EventKindSchema = z.enum(EVENT_KINDS);
export const PrioritySchema = z.enum(PRIORITIES);
export const DietTagSchema = z.enum(DIET_TAGS);
export const IdeaSectionSchema = z.enum(IDEA_SECTIONS);

/** Where a number came from. Shown next to every amount so an estimate never passes for a quote. */
const AmountSourceSchema = z.enum(["ai_estimate", "template", "user", "quote", "sample"]);

const AllocationSchema = z.object({
  category: CategoryKeySchema,
  allocatedPaise: paise,
  locked: z.boolean(),
  source: AmountSourceSchema,
});

const RequirementStatusSchema = z.enum(["not_contacted", "enquired", "quoted", "selected", "confirmed"]);

const RequirementSchema = z.object({
  id: z.string(),
  category: CategoryKeySchema,
  label: shortText(80),
  required: z.boolean(),
  coverageTags: z.array(z.string()).max(10),
  why: shortText(240),
  questions: z.array(shortText(200)).max(8),
  bookByLeadDays: z.number().int().min(0).max(730),
  bookBy: isoDate,
  priority: PrioritySchema,
  status: RequirementStatusSchema,
  contact: z.object({ name: shortText(80), phone: shortText(30), email: shortText(120) }),
  notes: shortText(1000),
  decided: z.boolean(),
});

const TaskSchema = z.object({
  id: z.string(),
  title: shortText(120),
  category: CategoryKeySchema.nullable(),
  leadDays: z.number().int().min(-60).max(730).nullable(),
  due: isoDate,
  doNow: z.boolean(),
  priority: PrioritySchema,
  done: z.boolean(),
  origin: z.enum(["plan", "payment", "user"]),
  quoteId: z.string().nullable(),
  amountPaise: paise.nullable(),
});

const IdeaSchema = z.object({
  id: z.string(),
  section: IdeaSectionSchema,
  title: shortText(80),
  description: shortText(400),
  whyItFits: shortText(240),
  dietTags: z.array(DietTagSchema),
  pinned: z.boolean(),
});

const DaySlotSchema = z.object({
  id: z.string(),
  startMinute: z.number().int().min(-720).max(1440),
  durationMinutes: z.number().int().min(5).max(720),
  title: shortText(80),
  ownerRole: shortText(40),
});

/** A cost term a quote may state, include, leave unknown, or not need at all. Unknown is never zero. */
const CostTermSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("included") }),
  z.object({ state: z.literal("not_applicable") }),
  z.object({ state: z.literal("unknown") }),
  z.object({ state: z.literal("amount"), paise }),
]);

const LineBasisSchema = z.enum(["flat", "per_guest", "per_hour", "per_unit"]);

const QuoteLineSchema = z.object({
  id: z.string(),
  description: shortText(120),
  basis: LineBasisSchema,
  unitPaise: paise.nullable(),
  quantity: z.number().int().min(0).max(100_000).nullable(),
  mandatory: z.boolean(),
});

export const PaymentWhenSchema = z.enum(["on_booking", "days_before", "event_day", "after_event"]);

const QuoteTermsSchema = z.object({
  taxMode: z.enum(["included", "exclusive_known", "exclusive_unknown", "unknown"]),
  taxRateBp: z.number().int().min(0).max(5_000).nullable(),
  statedTaxPaise: paise.nullable(),
  transport: CostTermSchema,
  staffing: CostTermSchema,
  setup: CostTermSchema,
  paymentSchedule: z
    .array(
      z.object({
        shareBp: z.number().int().min(1).max(10_000),
        when: PaymentWhenSchema,
        days: z.number().int().min(0).max(365).nullable(),
      }),
    )
    .max(6),
  depositRefundable: z.enum(["yes", "no", "unknown"]),
  cancellation: shortText(500),
  validUntil: isoDate.nullable(),
});

const ProvenanceSchema = z.enum(["ai_unverified", "matched", "not_found", "user_confirmed"]);

const QuoteSchema = z.object({
  id: z.string(),
  category: CategoryKeySchema,
  vendorAlias: shortText(80),
  sourceType: z.enum(["pasted", "manual", "sample"]),
  sourceText: z.string().max(10_000),
  lines: z.array(QuoteLineSchema).max(40),
  inclusions: z.array(z.string()).max(20),
  exclusions: z.array(shortText(160)).max(20),
  terms: QuoteTermsSchema,
  guestCountAssumed: z.number().int().min(1).max(100_000).nullable(),
  /** Per-field provenance and the excerpt it came from, keyed by a stable field path. */
  provenance: z.record(z.string(), ProvenanceSchema),
  evidence: z.record(z.string(), z.string().max(400)),
  /** Questions the AI suggested asking this vendor, shown after the ones code derives. */
  aiQuestions: z.array(shortText(200)).max(3),
  confirmed: z.boolean(),
});

const DecisionSchema = z.object({
  category: CategoryKeySchema,
  quoteId: z.string(),
  committedPaise: paise,
  openQuestions: z.array(z.string()).max(12),
  decidedOn: isoDate,
});

export const EventSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string(),
  kind: EventKindSchema,
  title: shortText(100),
  date: isoDate,
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  city: shortText(80),
  guestCount: z.number().int().min(1).max(100_000),
  budgetPaise: paise,
  contingencyBp: z.number().int().min(0).max(3_000),
  dietary: z.array(DietTagSchema),
  cultureNote: shortText(300),
  brief: shortText(1_500),
  allocations: z.array(AllocationSchema),
  requirements: z.array(RequirementSchema),
  tasks: z.array(TaskSchema),
  ideas: z.array(IdeaSchema),
  dayOf: z.array(DaySlotSchema),
  quotes: z.array(QuoteSchema),
  decisions: z.array(DecisionSchema),
  assumptions: z.array(z.string()).max(10),
  openQuestions: z.array(z.string()).max(10),
  origin: z.enum(["ai", "template", "sample"]),
  createdOn: isoDate,
});

export type AmountSource = z.infer<typeof AmountSourceSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type RequirementStatus = z.infer<typeof RequirementStatusSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Idea = z.infer<typeof IdeaSchema>;
export type CostTerm = z.infer<typeof CostTermSchema>;
export type QuoteLine = z.infer<typeof QuoteLineSchema>;
export type QuoteTerms = z.infer<typeof QuoteTermsSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type EventPlan = z.infer<typeof EventSchema>;
