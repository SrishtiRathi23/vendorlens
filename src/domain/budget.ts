import { type CategoryKey, CATEGORY_KEYS } from "@/domain/categories";
import { applyBasisPoints, type Paise, sumPaise } from "@/domain/money";
import type { AmountSource, EventPlan } from "@/domain/schemas";

export interface CategoryBudget {
  category: CategoryKey;
  allocatedPaise: Paise;
  committedPaise: Paise | null;
  /** What the plan counts for this category: the chosen quote's known total, or the allocation. */
  plannedPaise: Paise;
  paidPaise: Paise;
  source: AmountSource;
  locked: boolean;
  /** A vendor is chosen but questions about its price are still open. */
  hasOpenQuestions: boolean;
}

export interface BudgetSummary {
  categories: CategoryBudget[];
  budgetPaise: Paise;
  contingencyPaise: Paise;
  plannedPaise: Paise;
  committedPaise: Paise;
  paidPaise: Paise;
  /** Negative when the plan is over budget. */
  remainingPaise: number;
}

/** Every budget figure on screen comes from here: one pure function, one rounding rule. */
export function summarizeBudget(event: EventPlan): BudgetSummary {
  const categories = CATEGORY_KEYS.map((category): CategoryBudget => {
    const allocation = event.allocations.find((a) => a.category === category);
    const decision = event.decisions.find((d) => d.category === category);
    const paidPaise = sumPaise(
      event.tasks
        .filter((t) => t.origin === "payment" && t.category === category && t.done)
        .map((t) => t.amountPaise ?? 0),
    );
    const allocatedPaise = allocation?.allocatedPaise ?? 0;
    return {
      category,
      allocatedPaise,
      committedPaise: decision?.committedPaise ?? null,
      plannedPaise: decision?.committedPaise ?? allocatedPaise,
      paidPaise,
      source: decision ? "quote" : (allocation?.source ?? "user"),
      locked: allocation?.locked ?? false,
      hasOpenQuestions: (decision?.openQuestions.length ?? 0) > 0,
    };
  });
  const contingencyPaise = applyBasisPoints(event.budgetPaise, event.contingencyBp);
  const plannedPaise = sumPaise(categories.map((c) => c.plannedPaise)) + contingencyPaise;
  return {
    categories,
    budgetPaise: event.budgetPaise,
    contingencyPaise,
    plannedPaise,
    committedPaise: sumPaise(categories.map((c) => c.committedPaise ?? 0)),
    paidPaise: sumPaise(categories.map((c) => c.paidPaise)),
    remainingPaise: event.budgetPaise - plannedPaise,
  };
}
