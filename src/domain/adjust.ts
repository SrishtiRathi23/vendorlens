import { isCoverageTag } from "@/domain/categories";
import type { AdjustContext, AdjustOperationAi, AdjustScope } from "@/domain/contracts";
import { dueFromLead, isIsoDate, type IsoDate } from "@/domain/dates";
import type { IdFactory } from "@/domain/ids";
import { rupeesToPaise } from "@/domain/money";
import type { EventPlan } from "@/domain/schemas";

/** Short refs (R1, T1, I1, D1) mapped to real ids, so the model never sees or invents ids. */
export type RefMap = Record<string, string>;

/** Builds the contact-free plan summary sent with an adjustment request, plus its ref map. */
export function adjustContext(event: EventPlan): { context: AdjustContext; refs: RefMap } {
  const refs: RefMap = {};
  const ref = (prefix: string, index: number, id: string) => {
    const key = `${prefix}${String(index + 1)}`;
    refs[key] = id;
    return key;
  };
  return {
    refs,
    context: {
      kind: event.kind,
      date: event.date,
      guestCount: event.guestCount,
      budgetRupees: Math.round(event.budgetPaise / 100),
      dietary: event.dietary,
      allocations: event.allocations.map((a) => ({
        category: a.category,
        rupees: Math.round(a.allocatedPaise / 100),
        locked: a.locked,
      })),
      requirements: event.requirements.slice(0, 40).map((r, i) => ({
        ref: ref("R", i, r.id),
        category: r.category,
        label: r.label,
        required: r.required,
        decided: r.decided,
      })),
      tasks: event.tasks
        .slice(0, 60)
        .map((t, i) => ({ ref: ref("T", i, t.id), title: t.title, due: t.due, priority: t.priority, done: t.done })),
      ideas: event.ideas
        .slice(0, 40)
        .map((idea, i) => ({ ref: ref("I", i, idea.id), section: idea.section, title: idea.title })),
      dayOf: event.dayOf.slice(0, 30).map((slot, i) => ({ ref: ref("D", i, slot.id), title: slot.title })),
    },
  };
}

const SCOPE_OPS: Record<AdjustScope, readonly AdjustOperationAi["op"][] | "all"> = {
  plan: "all",
  budget: ["set_budget", "set_allocation", "set_guest_count"],
  vendors: ["add_requirement", "update_requirement", "remove_requirement"],
  timeline: ["add_task", "update_task", "remove_task", "add_day_slot", "set_event_date"],
  ideas: ["add_idea", "remove_idea"],
};

export interface AdjustOutcome {
  event: EventPlan;
  skipped: { op: AdjustOperationAi["op"]; reason: string }[];
}

/**
 * Applies AI-proposed operations to a **copy** of the plan, enforcing the rules in code: refs must
 * resolve, decided vendors and locked allocations are never touched, required needs are never
 * removed, and operations outside the requested scope are dropped. Every skip is reported.
 */
export function applyAdjustment(
  event: EventPlan,
  operations: readonly AdjustOperationAi[],
  options: { scope: AdjustScope; refs: RefMap; today: IsoDate; newId: IdFactory },
): AdjustOutcome {
  const { scope, refs, today, newId } = options;
  const next: EventPlan = structuredClone(event);
  const skipped: AdjustOutcome["skipped"] = [];
  const allowed = SCOPE_OPS[scope];

  for (const op of operations.slice(0, 15)) {
    if (allowed !== "all" && !allowed.includes(op.op)) {
      skipped.push({ op: op.op, reason: `Outside the “${scope}” scope you asked about.` });
      continue;
    }
    const reason = applyOne(next, op, refs, today, newId);
    if (reason) skipped.push({ op: op.op, reason });
  }
  return { event: next, skipped };
}

/** Applies one operation in place; returns why it was skipped, or `null` when applied. */
function applyOne(
  plan: EventPlan,
  op: AdjustOperationAi,
  refs: RefMap,
  today: IsoDate,
  newId: IdFactory,
): string | null {
  const target = op.ref ? refs[op.ref] : undefined;
  const requirement = plan.requirements.find((r) => r.id === target);
  const task = plan.tasks.find((t) => t.id === target);

  switch (op.op) {
    case "set_guest_count": {
      if (op.number === null || !Number.isInteger(op.number) || op.number < 1 || op.number > 100_000)
        return "Guest count must be a whole number.";
      plan.guestCount = op.number;
      return null;
    }
    case "set_event_date": {
      if (!op.date || !isIsoDate(op.date) || op.date < today) return "The new date must be a valid date from today on.";
      plan.date = op.date;
      for (const t of plan.tasks)
        if (t.leadDays !== null && t.origin !== "payment") Object.assign(t, dueFromLead(op.date, t.leadDays, today));
      for (const r of plan.requirements) r.bookBy = dueFromLead(op.date, r.bookByLeadDays, today).due;
      return null;
    }
    case "set_budget": {
      const amount = op.number === null ? null : rupeesToPaise(op.number);
      if (amount === null || amount === 0) return "The budget must be a positive amount.";
      plan.budgetPaise = amount;
      return null;
    }
    case "set_allocation": {
      const allocation = plan.allocations.find((a) => a.category === op.category);
      const amount = op.number === null ? null : rupeesToPaise(op.number);
      if (!allocation || amount === null) return "Needs a category and an amount.";
      if (allocation.locked) return `The ${allocation.category} allocation is locked.`;
      Object.assign(allocation, { allocatedPaise: amount, source: "ai_estimate" });
      return null;
    }
    case "add_requirement": {
      if (!op.category || !op.title) return "A new vendor need must have a category and a name.";
      const lead = op.number !== null && Number.isInteger(op.number) && op.number >= 0 ? Math.min(op.number, 730) : 30;
      plan.requirements.push({
        id: newId(),
        category: op.category,
        label: op.title,
        required: op.required ?? true,
        coverageTags: (op.coverageTags ?? []).filter((tag) => op.category !== null && isCoverageTag(op.category, tag)),
        why: op.detail ?? "",
        questions: [],
        bookByLeadDays: lead,
        bookBy: dueFromLead(plan.date, lead, today).due,
        priority: op.priority ?? "medium",
        status: "not_contacted",
        contact: { name: "", phone: "", email: "" },
        notes: "",
        decided: false,
      });
      return null;
    }
    case "update_requirement":
    case "remove_requirement": {
      if (!requirement) return "That vendor need doesn't exist.";
      if (requirement.decided) return `“${requirement.label}” already has a chosen vendor, so it stays as it is.`;
      if (op.op === "remove_requirement") {
        if (requirement.required) return `“${requirement.label}” is required, so it can't be removed.`;
        plan.requirements = plan.requirements.filter((r) => r !== requirement);
        return null;
      }
      if (op.title) requirement.label = op.title;
      if (op.priority) requirement.priority = op.priority;
      if (op.required !== null) requirement.required = op.required;
      return null;
    }
    case "add_task": {
      if (!op.title) return "A new task needs a title.";
      const lead = op.number !== null && Number.isInteger(op.number) && op.number >= 0 ? Math.min(op.number, 730) : 14;
      plan.tasks.push({
        id: newId(),
        title: op.title,
        category: op.category,
        leadDays: lead,
        ...dueFromLead(plan.date, lead, today),
        priority: op.priority ?? "medium",
        done: false,
        origin: "user",
        quoteId: null,
        amountPaise: null,
      });
      return null;
    }
    case "update_task":
    case "remove_task": {
      if (!task) return "That task doesn't exist.";
      if (task.origin === "payment")
        return "Payment milestones follow the chosen vendor's terms and can't be changed here.";
      if (op.op === "remove_task") {
        plan.tasks = plan.tasks.filter((t) => t !== task);
        return null;
      }
      if (op.priority) task.priority = op.priority;
      if (op.number !== null && Number.isInteger(op.number) && op.number >= 0) {
        Object.assign(
          task,
          { leadDays: Math.min(op.number, 730) },
          dueFromLead(plan.date, Math.min(op.number, 730), today),
        );
      }
      return null;
    }
    case "add_idea": {
      if (!op.section || !op.title) return "A new idea needs a section and a title.";
      plan.ideas.push({
        id: newId(),
        section: op.section,
        title: op.title,
        description: op.detail ?? "",
        whyItFits: "Added from your request.",
        dietTags: [],
        pinned: false,
      });
      return null;
    }
    case "remove_idea": {
      if (!target || !plan.ideas.some((idea) => idea.id === target)) return "That idea doesn't exist.";
      plan.ideas = plan.ideas.filter((idea) => idea.id !== target);
      return null;
    }
    case "add_day_slot": {
      if (!op.title || op.number === null || !Number.isInteger(op.number) || op.number < -720 || op.number > 1440)
        return "A run-sheet slot needs a title and a start time.";
      plan.dayOf.push({
        id: newId(),
        startMinute: op.number,
        durationMinutes: 30,
        title: op.title,
        ownerRole: op.detail?.slice(0, 40) ?? "",
      });
      plan.dayOf.sort((a, b) => a.startMinute - b.startMinute);
      return null;
    }
  }
}
