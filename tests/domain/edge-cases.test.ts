import { describe, expect, it } from "vitest";
import { adjustContext, applyAdjustment } from "@/domain/adjust";
import { summarizeBudget } from "@/domain/budget";
import { compareQuotes } from "@/domain/compare";
import type { AdjustOperationAi, ExtractionAi } from "@/domain/contracts";
import { removeQuote } from "@/domain/decision";
import { diffEvents } from "@/domain/diff";
import { emptyQuote, quoteFromExtraction } from "@/domain/extraction";
import { sequentialIds } from "@/domain/ids";
import { extractNumbers } from "@/domain/numbers";
import { buildMilestones } from "@/domain/payment-schedule";
import { normalizeQuote } from "@/domain/quote-normalize";
import { buildSampleEvent, SAMPLE_QUOTE_TEXTS } from "@/domain/samples";
import { context, quote, TODAY } from "../helpers/factories";

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${String(index)}`);
  return item;
}

const blank: AdjustOperationAi = {
  op: "set_guest_count",
  ref: null,
  category: null,
  number: null,
  date: null,
  title: null,
  detail: null,
  priority: null,
  required: null,
  coverageTags: null,
  section: null,
};
const op = (fields: Partial<AdjustOperationAi>): AdjustOperationAi => ({ ...blank, ...fields });

function adjust(ops: AdjustOperationAi[], scope: "plan" | "budget" | "vendors" | "timeline" | "ideas" = "plan") {
  const event = buildSampleEvent("birthday", TODAY, sequentialIds("b"));
  const { refs, context: ctx } = adjustContext(event);
  return { ctx, ...applyAdjustment(event, ops, { scope, refs, today: TODAY, newId: sequentialIds("n") }) };
}

describe("every adjustment operation, valid and invalid", () => {
  it.each([
    op({ op: "set_guest_count", number: 0 }),
    op({ op: "set_budget", number: 0 }),
    op({ op: "set_budget" }),
    op({ op: "set_allocation", number: 100 }),
    op({ op: "add_requirement", title: "No category" }),
    op({ op: "update_requirement", ref: "R99" }),
    op({ op: "add_task" }),
    op({ op: "update_task", ref: "T99" }),
    op({ op: "add_idea", title: "No section" }),
    op({ op: "remove_idea", ref: "I99" }),
    op({ op: "add_day_slot", title: "No time" }),
    op({ op: "add_day_slot", title: "Too late", number: 5000 }),
  ])("skips invalid %#", (operation) => {
    const result = adjust([operation]);
    expect(result.skipped).toHaveLength(1);
    expect(result.event).toEqual(result.event); // still a valid object
  });

  it("applies updates to needs, tasks, ideas and budget lines", () => {
    const { event, ctx, ...result } = adjust([]);
    const optionalNeed = ctx.requirements.find((r) => !r.required);
    const firstTask = ctx.tasks[0];
    const firstIdea = ctx.ideas[0];
    const applied = adjust([
      op({
        op: "update_requirement",
        ref: ctx.requirements[0]?.ref ?? null,
        title: "Rooftop venue",
        priority: "low",
        required: true,
      }),
      op({ op: "update_task", ref: firstTask?.ref ?? null, priority: "low", number: 20 }),
      op({ op: "remove_task", ref: ctx.tasks[1]?.ref ?? null }),
      op({ op: "remove_idea", ref: firstIdea?.ref ?? null }),
      op({ op: "remove_requirement", ref: optionalNeed?.ref ?? null }),
      op({ op: "set_allocation", category: "decor", number: 20_000 }),
      op({ op: "set_budget", number: 150_000 }),
      op({
        op: "add_requirement",
        category: "photography",
        title: "Photographer",
        required: false,
        priority: "low",
        number: -5,
      }),
      op({ op: "add_task", title: "Confirm cake flavour", number: -1 }),
    ]);
    expect(result.skipped).toEqual([]);
    expect(applied.skipped).toEqual([]);
    expect(applied.event.requirements[0]).toMatchObject({ label: "Rooftop venue", priority: "low" });
    expect(applied.event.tasks[0]).toMatchObject({ priority: "low", leadDays: 20 });
    expect(applied.event.tasks).toHaveLength(event.tasks.length); // one removed, one added
    expect(applied.event.ideas).toHaveLength(event.ideas.length - 1);
    expect(applied.event.allocations.find((a) => a.category === "decor")).toMatchObject({
      allocatedPaise: 2_000_000,
      source: "ai_estimate",
    });
    expect(applied.event.budgetPaise).toBe(15_000_000);
    expect(applied.event.requirements.at(-1)).toMatchObject({ bookByLeadDays: 30, required: false });
    expect(applied.event.tasks.at(-1)).toMatchObject({ leadDays: 14 });
  });

  it.each([
    ["budget", op({ op: "add_idea", section: "menu", title: "x" })],
    ["vendors", op({ op: "add_task", title: "x" })],
    ["timeline", op({ op: "set_budget", number: 10 })],
  ] as const)("drops operations outside the %s scope", (scope, operation) => {
    expect(adjust([operation], scope).skipped[0]?.reason).toContain(scope);
  });

  it("protects payment milestones", () => {
    const event = buildSampleEvent("birthday", TODAY, sequentialIds("p"));
    const withPayment = {
      ...event,
      tasks: [{ ...at(event.tasks, 0), origin: "payment" as const, leadDays: null }, ...event.tasks.slice(1)],
    };
    const { refs } = adjustContext(withPayment);
    const result = applyAdjustment(withPayment, [op({ op: "update_task", ref: "T1", priority: "low" })], {
      scope: "plan",
      refs,
      today: TODAY,
      newId: sequentialIds(),
    });
    expect(result.skipped[0]?.reason).toContain("Payment milestones");
  });
});

describe("diff, budget and quote removal", () => {
  it("describes budget, allocation, date and removal changes", () => {
    const before = buildSampleEvent("community", TODAY, sequentialIds("d"));
    const after = {
      ...before,
      budgetPaise: before.budgetPaise + 100,
      date: "2027-01-20",
      allocations: before.allocations.map((a, i) => (i === 0 ? { ...a, allocatedPaise: a.allocatedPaise + 100 } : a)),
      ideas: before.ideas.slice(1),
      dayOf: before.dayOf.map((s, i) => (i === 0 ? { ...s, title: "Earlier setup" } : s)),
    };
    const kinds = diffEvents(before, after).map((c) => `${c.area}:${c.kind}`);
    expect(kinds).toEqual(
      expect.arrayContaining(["Budget:changed", "Event:changed", "Ideas:removed", "Day-of:changed"]),
    );
  });

  it("treats a plan without allocations as all-zero rather than failing", () => {
    const event = { ...buildSampleEvent("birthday", TODAY, sequentialIds()), allocations: [] };
    const summary = summarizeBudget(event);
    expect(summary.categories.every((c) => c.allocatedPaise === 0 && c.source === "user" && !c.locked)).toBe(true);
  });

  it("removing the chosen quote reopens the category; unknown ids change nothing", () => {
    const event = buildSampleEvent("wedding", TODAY, sequentialIds("w"));
    const chosen = {
      ...event,
      decisions: [
        {
          category: "catering" as const,
          quoteId: at(event.quotes, 0).id,
          committedPaise: 1,
          openQuestions: [],
          decidedOn: TODAY,
        },
      ],
    };
    const after = removeQuote(chosen, at(event.quotes, 0).id);
    expect(after.decisions).toEqual([]);
    expect(after.requirements.filter((r) => r.category === "catering").every((r) => !r.decided)).toBe(true);
    expect(removeQuote(event, "missing")).toBe(event);
    expect(removeQuote(event, at(event.quotes, 1).id).requirements).toBe(event.requirements);
  });
});

describe("quote edge cases", () => {
  it("plural verdict and every payment timing", () => {
    const a = normalizeQuote(quote({ id: "a", vendorAlias: "A" }, { taxMode: "unknown" }), context());
    const b = normalizeQuote(quote({ id: "b", vendorAlias: "B" }, { taxMode: "unknown" }), context());
    expect(compareQuotes([a, b]).verdict).toContain("A, B have");
    const milestones = buildMilestones(
      1_000,
      [
        { shareBp: 5_000, when: "after_event", days: null },
        { shareBp: 5_000, when: "days_before", days: null },
      ],
      "2027-02-14",
      TODAY,
    );
    expect(milestones.map((m) => m.due)).toEqual(["2027-02-21", "2027-02-14"]);
  });

  it("extraction keeps only what the quote supports", () => {
    const none = { state: "unknown" as const, rupees: null, evidence: "" };
    const extraction: ExtractionAi = {
      currency: "INR",
      vendorAlias: { value: null, evidence: "" },
      lines: [{ description: "", basis: "flat", unitRupees: null, quantity: null, evidence: "Wedding dinner package" }],
      inclusions: [],
      exclusions: [{ text: "Made-up exclusion", evidence: "not in the quote" }],
      tax: { mode: "exclusive_known", ratePercent: 18, statedRupees: null, evidence: "Taxes as applicable." },
      transport: { state: "amount", rupees: null, evidence: "Transport extra as applicable." },
      staffing: { state: "included", rupees: null, evidence: "no such words" },
      setup: none,
      paymentSchedule: [],
      depositRefundable: { value: "yes", evidence: "refund on request" },
      cancellation: { value: "Free cancellation", evidence: "nowhere" },
      validUntil: { value: "30 November", evidence: "Quote valid till 30 November." },
      guestCountAssumed: { value: 999, evidence: "minimum 100 plates" },
      suggestedQuestions: ["Q1", "Q2", "Q3", "Q4"],
    };
    const result = quoteFromExtraction(extraction, {
      sourceText: SAMPLE_QUOTE_TEXTS.offerA,
      category: "catering",
      newId: sequentialIds(),
    });
    expect(result).toMatchObject({
      vendorAlias: "Unnamed vendor",
      exclusions: [],
      guestCountAssumed: null,
      aiQuestions: ["Q1", "Q2", "Q3"],
    });
    expect(result.lines[0]).toMatchObject({ description: "Item", unitPaise: null });
    expect(result.terms).toMatchObject({
      taxMode: "unknown",
      transport: { state: "unknown" },
      staffing: { state: "unknown" },
      depositRefundable: "unknown",
      cancellation: "",
      validUntil: null,
    });
  });

  it("a blank manual quote starts with every cost unknown", () => {
    const blankQuote = emptyQuote("decor", "", sequentialIds());
    expect(blankQuote.terms.taxMode).toBe("unknown");
    expect(normalizeQuote({ ...blankQuote, category: "decor", confirmed: true }, context()).status).toBe("incomplete");
  });

  it("reads lakh and lac spellings", () => {
    expect(extractNumbers("2 lacs, 3 lakhs and 1.25 crores")).toEqual([200_000, 300_000, 12_500_000]);
  });
});
