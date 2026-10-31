"use client";

import { type SyntheticEvent, useState } from "react";
import { dueFromLead, isIsoDate } from "@/domain/dates";
import { formatINR, parseRupeeInput } from "@/domain/money";
import type { EventPlan } from "@/domain/schemas";
import { usePlanStore } from "@/features/store/plan-store";
import { Button, Field, inputClass } from "@/ui/controls";

/** Edit the event facts directly. Dates of plan tasks and booking deadlines move with the event date. */
export function EventDetails({ plan }: { plan: EventPlan }) {
  const { update, today } = usePlanStore();
  const [guests, setGuests] = useState(String(plan.guestCount));
  const [budget, setBudget] = useState(formatINR(plan.budgetPaise).replace("₹", ""));
  const [date, setDate] = useState(plan.date);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const save = (event: SyntheticEvent) => {
    event.preventDefault();
    const guestCount = Number(guests);
    const budgetPaise = parseRupeeInput(budget);
    const problem =
      !Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100_000
        ? "Guests must be a whole number from 1 to 1,00,000."
        : budgetPaise === null || budgetPaise === 0
          ? "Enter a budget such as 8,50,000."
          : !isIsoDate(date) || !today || date < today
            ? "The date must be today or later."
            : "";
    setError(problem);
    if (problem || budgetPaise === null || !today) return;
    update((current) => ({
      ...current,
      guestCount,
      budgetPaise,
      date,
      tasks: current.tasks.map((t) =>
        t.leadDays !== null && t.origin !== "payment" ? { ...t, ...dueFromLead(date, t.leadDays, today) } : t,
      ),
      requirements: current.requirements.map((r) => ({ ...r, bookBy: dueFromLead(date, r.bookByLeadDays, today).due })),
    }));
    setSaved("Saved. Per-guest quotes now use the new guest count.");
  };

  return (
    <section aria-labelledby="details-heading" className="flex flex-col gap-3 print:hidden">
      <h2 id="details-heading" className="font-display text-2xl font-semibold text-forest">
        Event details
      </h2>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" noValidate>
        <Field label="Guests">
          {(p) => (
            <input
              {...p}
              inputMode="numeric"
              className={inputClass}
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
            />
          )}
        </Field>
        <Field label="Total budget (₹)">
          {(p) => (
            <input
              {...p}
              inputMode="decimal"
              className={inputClass}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          )}
        </Field>
        <Field label="Date">
          {(p) => (
            <input {...p} type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          )}
        </Field>
        <Button type="submit">Save details</Button>
      </form>
      <p role="status" className="text-sm">
        {error ? <span className="font-medium text-brick">{error}</span> : saved}
      </p>
    </section>
  );
}
