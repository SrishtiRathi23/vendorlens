"use client";

import Link from "next/link";
import { summarizeBudget } from "@/domain/budget";
import { formatDate } from "@/domain/dates";
import type { EventPlan, RequirementStatus } from "@/domain/schemas";
import { bucketTasks, daysToGo } from "@/domain/timeline";
import { EventDetails } from "@/features/overview/EventDetails";
import { PlanActions } from "@/features/overview/PlanActions";
import { usePlanStore } from "@/features/store/plan-store";
import { Money } from "@/ui/Money";

const STATUS_LABEL: Record<RequirementStatus, string> = {
  not_contacted: "Not contacted",
  enquired: "Enquired",
  quoted: "Quoted",
  selected: "Vendor chosen",
  confirmed: "Confirmed",
};

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-cream bg-white/60 p-4">
      <p className="text-sm text-charcoal/80">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-forest">{children}</p>
    </div>
  );
}

function countdownText(plan: EventPlan, today: string): string {
  const days = daysToGo(plan, today);
  if (days > 1) return `${String(days)} days to go`;
  if (days === 1) return "Tomorrow";
  if (days === 0) return "Today!";
  return `${String(-days)} days ago`;
}

export function Overview() {
  const { plan, today } = usePlanStore();
  if (!plan) return null;
  const budget = summarizeBudget(plan);
  const tasks = today ? bucketTasks(plan.tasks, today) : null;
  const next = tasks ? [...tasks.overdue, ...tasks.thisWeek, ...tasks.later].slice(0, 5) : [];
  const counts = plan.requirements.reduce<Partial<Record<RequirementStatus, number>>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {},
  );

  return (
    <>
      <h1 className="font-display text-4xl font-semibold text-forest">Overview</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Countdown">{today ? countdownText(plan, today) : "…"}</Tile>
        <Tile label="Budget">
          <Money paise={budget.budgetPaise} />
        </Tile>
        <Tile label="Planned spend">
          <Money paise={budget.plannedPaise} />
        </Tile>
        <Tile label="Committed to vendors">
          <Money paise={budget.committedPaise} />
        </Tile>
        <Tile label={budget.remainingPaise < 0 ? "Over budget by" : "Remaining"}>
          <span className={budget.remainingPaise < 0 ? "text-brick" : ""}>
            <Money paise={Math.abs(budget.remainingPaise)} />
          </span>
        </Tile>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="next-heading" className="flex flex-col gap-2">
          <h2 id="next-heading" className="font-display text-2xl font-semibold text-forest">
            Next up
          </h2>
          {next.length === 0 ? (
            <p>Nothing due. Everything is ticked off.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-cream rounded-lg border border-cream">
              {next.map((task) => (
                <li key={task.id} className="flex flex-wrap justify-between gap-2 p-3">
                  <span>
                    {task.title}
                    {task.doNow && <span className="ml-2 text-sm font-medium text-brick">do now</span>}
                  </span>
                  <span className="text-sm">
                    {today && task.due < today ? `Overdue since ${formatDate(task.due)}` : formatDate(task.due)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/workspace/timeline" className="text-sm text-emerald underline underline-offset-4">
            Full timeline
          </Link>
        </section>

        <section aria-labelledby="vendors-heading" className="flex flex-col gap-2">
          <h2 id="vendors-heading" className="font-display text-2xl font-semibold text-forest">
            Vendor progress
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(STATUS_LABEL) as RequirementStatus[]).map((status) => (
              <li key={status} className="rounded-md border border-cream p-3">
                <span className="figures block text-2xl font-semibold text-forest">{counts[status] ?? 0}</span>
                <span className="text-sm">{STATUS_LABEL[status]}</span>
              </li>
            ))}
          </ul>
          <Link href="/workspace/vendors" className="text-sm text-emerald underline underline-offset-4">
            Vendor checklist and quotes
          </Link>
        </section>
      </div>

      {(plan.openQuestions.length > 0 || plan.assumptions.length > 0) && (
        <section aria-labelledby="notes-heading" className="grid gap-4 lg:grid-cols-2">
          <h2 id="notes-heading" className="sr-only">
            Notes on this plan
          </h2>
          {plan.openQuestions.length > 0 && (
            <div>
              <h3 className="font-medium text-forest">Questions to settle</h3>
              <ul className="list-disc pl-5">
                {plan.openQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.assumptions.length > 0 && (
            <div>
              <h3 className="font-medium text-forest">Assumptions and notes</h3>
              <ul className="list-disc pl-5">
                {plan.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <EventDetails plan={plan} />
      <PlanActions plan={plan} />
    </>
  );
}
