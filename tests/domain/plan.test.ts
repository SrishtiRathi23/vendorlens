import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { summarizeBudget } from "@/domain/budget";
import { EVENT_KINDS } from "@/domain/categories";
import { PlanDraftAiSchema } from "@/domain/contracts";
import { sequentialIds } from "@/domain/ids";
import { buildEventFromDraft, PlanError, topologicalOrder } from "@/domain/plan-build";
import { buildSampleEvent, SAMPLE_BRIEFS } from "@/domain/samples";
import { EventSchema } from "@/domain/schemas";
import { TEMPLATE_DRAFTS } from "@/domain/templates";
import { bookingDeadlines, bucketTasks, daysToGo } from "@/domain/timeline";
import { TODAY } from "../helpers/factories";

describe("templates and samples", () => {
  it.each(EVENT_KINDS)("the %s template is a valid draft and builds a valid event", (kind) => {
    expect(PlanDraftAiSchema.safeParse(TEMPLATE_DRAFTS[kind]).success).toBe(true);
    const event = buildSampleEvent(kind, TODAY, sequentialIds(kind));
    expect(EventSchema.safeParse(event).success).toBe(true);
    expect(event.ideas.some((idea) => idea.section === "accessibility")).toBe(true);
    expect(event.ideas.some((idea) => idea.section === "sustainability")).toBe(true);
  });
});

describe("buildEventFromDraft", () => {
  it("Q16 · category allocations plus contingency equal the budget exactly, for any budget", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100_000, max: 1_000_000_000 }),
        fc.integer({ min: 0, max: 3_000 }),
        fc.constantFrom(...EVENT_KINDS),
        (budget, contingencyBp, kind) => {
          const brief = { ...SAMPLE_BRIEFS[kind](TODAY), budgetPaise: budget, contingencyBp };
          const event = buildEventFromDraft(brief, TEMPLATE_DRAFTS[kind], {
            today: TODAY,
            origin: "template",
            newId: sequentialIds(),
          });
          const summary = summarizeBudget(event);
          expect(summary.plannedPaise).toBe(budget);
          expect(summary.remainingPaise).toBe(0);
        },
      ),
    );
  });

  it("schedules prerequisites no later than the tasks that depend on them", () => {
    const event = buildSampleEvent("wedding", TODAY, sequentialIds());
    const byTitle = new Map(event.tasks.map((task) => [task.title, task.due]));
    const guestList = byTitle.get("Agree the guest list and budget with both families") ?? "";
    const venues = byTitle.get("Shortlist and visit three venues") ?? "";
    expect(guestList <= venues).toBe(true);
    expect(event.tasks.every((task) => task.due >= TODAY)).toBe(true);
  });

  it("moves overdue work to today and flags it instead of showing a past date", () => {
    const brief = { ...SAMPLE_BRIEFS.birthday(TODAY), date: "2026-11-10" };
    const event = buildEventFromDraft(brief, TEMPLATE_DRAFTS.birthday, {
      today: TODAY,
      origin: "template",
      newId: sequentialIds(),
    });
    const fixDate = event.tasks.find((task) => task.title === "Fix the date and the guest list");
    expect(fixDate).toMatchObject({ due: TODAY, doNow: true });
  });

  it("rejects dependency cycles and ignores unknown refs", () => {
    expect(() =>
      topologicalOrder([
        { ref: "T1", dependsOn: ["T2"] },
        { ref: "T2", dependsOn: ["T1"] },
      ]),
    ).toThrow(PlanError);
    expect(topologicalOrder([{ ref: "T1", dependsOn: ["T9", "T1"] }])).toEqual(["T1"]);
  });

  it("drops coverage tags that don't belong to the category", () => {
    const draft = structuredClone(TEMPLATE_DRAFTS.birthday);
    draft.requirements[0]?.coverageTags.push("drone", "parking");
    const event = buildEventFromDraft(SAMPLE_BRIEFS.birthday(TODAY), draft, {
      today: TODAY,
      origin: "ai",
      newId: sequentialIds(),
    });
    expect(event.requirements[0]?.coverageTags).toEqual(["power_backup", "step_free_access", "parking"]);
    expect(event.allocations.every((a) => a.source === "ai_estimate")).toBe(true);
  });
});

describe("timeline helpers", () => {
  it("counts down and buckets tasks for reminders", () => {
    const event = buildSampleEvent("birthday", TODAY, sequentialIds());
    expect(daysToGo(event, TODAY)).toBe(40);
    const tasks = event.tasks.map((task, i) =>
      i === 0 ? { ...task, due: "2026-10-30", done: false } : i === 1 ? { ...task, done: true } : task,
    );
    const buckets = bucketTasks(tasks, TODAY);
    expect(buckets.overdue).toHaveLength(1);
    expect(buckets.done).toHaveLength(1);
    expect(buckets.overdue.length + buckets.thisWeek.length + buckets.later.length + buckets.done.length).toBe(
      tasks.length,
    );
    expect(bookingDeadlines(event).map((d) => d.bookBy)).toEqual(
      [...bookingDeadlines(event).map((d) => d.bookBy)].sort(),
    );
  });
});
