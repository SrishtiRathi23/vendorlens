import { allocate } from "@/domain/allocation";
import { CATEGORY_KEYS, isCoverageTag } from "@/domain/categories";
import type { EventBrief, PlanDraftAi } from "@/domain/contracts";
import { addDays, daysBetween, dueFromLead, type IsoDate } from "@/domain/dates";
import type { IdFactory } from "@/domain/ids";
import { applyBasisPoints } from "@/domain/money";
import type { AmountSource, EventPlan, Task } from "@/domain/schemas";

export class PlanError extends Error {
  constructor(readonly code: "DEPENDENCY_CYCLE") {
    super(code);
    this.name = "PlanError";
  }
}

/**
 * Orders task refs so every prerequisite comes before the task that depends on it.
 * Unknown refs are ignored; a cycle throws, because no due dates can satisfy it.
 */
export function topologicalOrder(tasks: readonly { ref: string; dependsOn: readonly string[] }[]): string[] {
  const known = new Set(tasks.map((task) => task.ref));
  const edges = new Map(
    tasks.map((task) => [task.ref, task.dependsOn.filter((dep) => known.has(dep) && dep !== task.ref)]),
  );
  const order: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (ref: string): void => {
    if (state.get(ref) === "done") return;
    if (state.get(ref) === "visiting") throw new PlanError("DEPENDENCY_CYCLE");
    state.set(ref, "visiting");
    for (const dep of edges.get(ref) ?? []) visit(dep);
    state.set(ref, "done");
    order.push(ref);
  };
  for (const task of tasks) visit(task.ref);
  return order;
}

/** Category weights in canonical order; categories the draft omitted get 0. */
function categoryWeights(draft: Pick<PlanDraftAi, "categories">): number[] {
  return CATEGORY_KEYS.map((key) =>
    draft.categories.filter((c) => c.key === key).reduce((sum, c) => sum + c.weightBp, 0),
  );
}

/**
 * Builds a full, exact event plan from a draft. The draft only says *what matters and how much,
 * relatively*; this function turns that into paise that add up to the budget exactly, IST due dates
 * that respect dependencies, and ids. Nothing in the draft can set a total or a confirmation.
 */
export function buildEventFromDraft(
  brief: EventBrief,
  draft: PlanDraftAi,
  options: { today: IsoDate; origin: EventPlan["origin"]; newId: IdFactory },
): EventPlan {
  const { today, origin, newId } = options;
  const source: AmountSource = origin === "ai" ? "ai_estimate" : origin;
  const contingency = applyBasisPoints(brief.budgetPaise, brief.contingencyBp);
  const amounts = allocate(brief.budgetPaise - contingency, categoryWeights(draft));

  const ideal = new Map<string, IsoDate>();
  const byRef = new Map(draft.tasks.map((task) => [task.ref, task]));
  for (const ref of topologicalOrder(draft.tasks)) {
    const task = byRef.get(ref);
    if (!task) continue;
    const own = addDays(brief.date, -task.leadDays);
    const afterDeps = task.dependsOn.map((dep) => ideal.get(dep)).filter((d): d is IsoDate => d !== undefined);
    ideal.set(ref, [own, ...afterDeps].sort().at(-1) ?? own);
  }

  const tasks: Task[] = draft.tasks.map((task) => {
    const leadDays = Math.max(0, daysBetween(ideal.get(task.ref) ?? brief.date, brief.date));
    const { due, doNow } = dueFromLead(brief.date, leadDays, today);
    return {
      id: newId(),
      title: task.title,
      category: task.category,
      leadDays,
      due,
      doNow,
      priority: task.priority,
      done: false,
      origin: "plan",
      quoteId: null,
      amountPaise: null,
    };
  });

  return {
    schemaVersion: 2,
    id: newId(),
    kind: brief.kind,
    title: brief.title,
    date: brief.date,
    startTime: brief.startTime,
    city: brief.city,
    guestCount: brief.guestCount,
    budgetPaise: brief.budgetPaise,
    contingencyBp: brief.contingencyBp,
    dietary: brief.dietary,
    cultureNote: brief.cultureNote,
    brief: brief.brief,
    allocations: CATEGORY_KEYS.map((category, index) => ({
      category,
      allocatedPaise: amounts[index] ?? 0,
      locked: false,
      source,
    })),
    requirements: draft.requirements.map((req) => ({
      id: newId(),
      category: req.category,
      label: req.label,
      required: req.required,
      coverageTags: [...new Set(req.coverageTags.filter((tag) => isCoverageTag(req.category, tag)))],
      why: req.why,
      questions: req.questions,
      bookByLeadDays: req.bookByLeadDays,
      bookBy: dueFromLead(brief.date, req.bookByLeadDays, today).due,
      priority: req.priority,
      status: "not_contacted",
      contact: { name: "", phone: "", email: "" },
      notes: "",
      decided: false,
    })),
    tasks,
    ideas: draft.ideas.map((idea) => ({ id: newId(), ...idea, pinned: false })),
    dayOf: [...draft.dayOf].sort((a, b) => a.startMinute - b.startMinute).map((slot) => ({ id: newId(), ...slot })),
    quotes: [],
    decisions: [],
    assumptions: draft.assumptions,
    openQuestions: draft.openQuestions,
    origin,
    createdOn: today,
  };
}
