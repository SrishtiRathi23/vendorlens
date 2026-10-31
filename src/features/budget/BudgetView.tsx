"use client";

import { useState } from "react";
import { type CategoryBudget, summarizeBudget } from "@/domain/budget";
import { CATEGORY_LABEL, type CategoryKey } from "@/domain/categories";
import { formatINR, parseRupeeInput } from "@/domain/money";
import type { AmountSource, EventPlan } from "@/domain/schemas";
import { usePlanStore } from "@/features/store/plan-store";
import { Badge, inputClass } from "@/ui/controls";
import { Money } from "@/ui/Money";

const SOURCE_LABEL: Record<AmountSource, string> = {
  ai_estimate: "AI estimate",
  template: "Template estimate",
  user: "Your figure",
  quote: "Chosen quote",
  sample: "Sample figure",
};

function AllocationInput({ row }: { row: CategoryBudget }) {
  const { update } = usePlanStore();
  const [value, setValue] = useState(formatINR(row.allocatedPaise).replace("₹", ""));
  const [invalid, setInvalid] = useState(false);
  const label = `${CATEGORY_LABEL[row.category]} allocation in rupees`;

  const commit = () => {
    const paise = parseRupeeInput(value);
    setInvalid(paise === null);
    if (paise === null || paise === row.allocatedPaise) return;
    update((plan) => ({
      ...plan,
      allocations: plan.allocations.map((a) =>
        a.category === row.category ? { ...a, allocatedPaise: paise, source: "user" as const } : a,
      ),
    }));
  };

  return (
    <input
      aria-label={label}
      aria-invalid={invalid || undefined}
      inputMode="decimal"
      disabled={row.locked}
      className={`${inputClass} figures max-w-40 ${invalid ? "border-brick" : ""}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

function toggleLock(category: CategoryKey) {
  return (plan: EventPlan): EventPlan => ({
    ...plan,
    allocations: plan.allocations.map((a) => (a.category === category ? { ...a, locked: !a.locked } : a)),
  });
}

export function BudgetView() {
  const { plan, update } = usePlanStore();
  if (!plan) return null;
  const summary = summarizeBudget(plan);
  const scale = Math.max(summary.budgetPaise, summary.plannedPaise, 1);

  return (
    <>
      <h1 className="font-display text-4xl font-semibold text-forest">Budget</h1>
      <p className="max-w-3xl">
        Allocations start as estimates and add up to your budget exactly. Once you choose a vendor, its quote&apos;s
        known total replaces the estimate. Lock a line to keep AI adjustments away from it.
      </p>
      <p
        role="status"
        className={`figures text-lg font-medium ${summary.remainingPaise < 0 ? "text-brick" : "text-forest"}`}
      >
        {summary.remainingPaise < 0
          ? `Over budget by ${formatINR(-summary.remainingPaise)}`
          : `${formatINR(summary.remainingPaise)} unallocated of ${formatINR(summary.budgetPaise)}`}
      </p>

      <div
        role="region"
        aria-label="Budget by category"
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-cream"
      >
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <caption className="sr-only">Budget by category: allocated, committed, paid and planned amounts</caption>
          <thead className="bg-sage text-left">
            <tr>
              {["Category", "Allocated", "Committed", "Paid", "Counts as", "Share of budget", "Lock"].map((h) => (
                <th key={h} scope="col" className="p-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.categories.map((row) => (
              <tr key={row.category} className="border-t border-cream align-middle">
                <th scope="row" className="p-3 text-left font-medium text-forest">
                  {CATEGORY_LABEL[row.category]}
                  <span className="mt-1 block">
                    <Badge tone={row.source === "quote" ? "good" : "neutral"}>{SOURCE_LABEL[row.source]}</Badge>
                    {row.hasOpenQuestions && <span className="ml-1 text-xs text-brick">open questions</span>}
                  </span>
                </th>
                <td className="p-3">
                  <AllocationInput key={`${row.category}-${String(row.allocatedPaise)}`} row={row} />
                </td>
                <td className="p-3">{row.committedPaise === null ? "—" : <Money paise={row.committedPaise} />}</td>
                <td className="p-3">
                  <Money paise={row.paidPaise} />
                </td>
                <td className="p-3">
                  <Money paise={row.plannedPaise} />
                </td>
                <td className="p-3">
                  <div className="h-3 w-32 overflow-hidden rounded bg-cream" aria-hidden="true">
                    <div
                      className="h-full bg-emerald"
                      style={{ width: `${String(Math.min(100, (row.plannedPaise / scale) * 100))}%` }}
                    />
                  </div>
                  <span className="figures text-xs">
                    {((row.plannedPaise / Math.max(summary.budgetPaise, 1)) * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="p-3">
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" checked={row.locked} onChange={() => update(toggleLock(row.category))} />
                    <span className="sr-only">Lock {CATEGORY_LABEL[row.category]}</span>
                    <span aria-hidden="true">{row.locked ? "Locked" : "Open"}</span>
                  </label>
                </td>
              </tr>
            ))}
            <tr className="border-t border-cream">
              <th scope="row" className="p-3 text-left font-medium text-forest">
                Contingency ({(plan.contingencyBp / 100).toFixed(1)}%)
              </th>
              <td className="p-3" colSpan={3}>
                Held back for surprises
              </td>
              <td className="p-3">
                <Money paise={summary.contingencyPaise} />
              </td>
              <td colSpan={2} />
            </tr>
          </tbody>
          <tfoot className="border-t-2 border-forest font-semibold">
            <tr>
              <th scope="row" className="p-3 text-left">
                Total
              </th>
              <td className="p-3" />
              <td className="p-3">
                <Money paise={summary.committedPaise} />
              </td>
              <td className="p-3">
                <Money paise={summary.paidPaise} />
              </td>
              <td className="p-3">
                <Money paise={summary.plannedPaise} />
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
