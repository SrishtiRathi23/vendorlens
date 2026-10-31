"use client";

import Link from "next/link";
import { type SyntheticEvent, useState } from "react";
import { CATEGORY_KEYS, CATEGORY_LABEL, type CategoryKey } from "@/domain/categories";
import { dueFromLead } from "@/domain/dates";
import { removeQuote } from "@/domain/decision";
import { randomId } from "@/domain/ids";
import type { Quote } from "@/domain/schemas";
import { usePlanStore } from "@/features/store/plan-store";
import { QuoteIntake } from "@/features/vendors/QuoteIntake";
import { QuoteReview } from "@/features/vendors/QuoteReview";
import { RequirementCard } from "@/features/vendors/RequirementCard";
import { Badge, Button, Field, inputClass } from "@/ui/controls";

function QuoteRow({ quote, chosen, onReview }: { quote: Quote; chosen: boolean; onReview: () => void }) {
  const { update } = usePlanStore();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-cream p-3">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{quote.vendorAlias || "Unnamed vendor"}</span>
        <Badge tone={quote.confirmed ? "good" : "warn"}>{quote.confirmed ? "Confirmed" : "Needs your review"}</Badge>
        {chosen && <Badge tone="info">Chosen</Badge>}
      </span>
      <span className="flex gap-2">
        <Button variant="secondary" onClick={onReview}>
          {quote.confirmed ? "Edit" : "Review"}
        </Button>
        <Button variant="quiet" onClick={() => update((p) => removeQuote(p, quote.id))}>
          Remove
        </Button>
      </span>
    </li>
  );
}

function AddRequirement() {
  const { update, today } = usePlanStore();
  const [category, setCategory] = useState<CategoryKey>("decor");
  const [label, setLabel] = useState("");

  const add = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!label.trim() || !today) return;
    update((plan) => ({
      ...plan,
      requirements: [
        ...plan.requirements,
        {
          id: randomId(),
          category,
          label: label.trim(),
          required: true,
          coverageTags: [],
          why: "",
          questions: [],
          bookByLeadDays: 30,
          bookBy: dueFromLead(plan.date, 30, today).due,
          priority: "medium",
          status: "not_contacted",
          contact: { name: "", phone: "", email: "" },
          notes: "",
          decided: false,
        },
      ],
    }));
    setLabel("");
  };

  return (
    <form
      onSubmit={add}
      className="grid gap-3 rounded-lg border border-dashed border-forest/40 p-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
    >
      <Field label="Category">
        {(p) => (
          <select
            {...p}
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryKey)}
          >
            {CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABEL[key]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Vendor you need">
        {(p) => (
          <input
            {...p}
            className={inputClass}
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Mehendi artist"
          />
        )}
      </Field>
      <Button type="submit" disabled={!label.trim()}>
        Add vendor need
      </Button>
    </form>
  );
}

export function VendorsView() {
  const { plan, update } = usePlanStore();
  const [intakeFor, setIntakeFor] = useState<CategoryKey | null>(null);
  const [reviewing, setReviewing] = useState<Quote | null>(null);
  if (!plan) return null;

  const categories = CATEGORY_KEYS.filter(
    (key) => plan.requirements.some((r) => r.category === key) || plan.quotes.some((q) => q.category === key),
  );

  return (
    <>
      <h1 className="font-display text-4xl font-semibold text-forest">Vendors</h1>
      <p className="max-w-3xl">
        Each vendor need lists what its quotes should cover and when to book. Add quotes by pasting them or typing them
        in; once confirmed, compare them on the{" "}
        <Link href="/workspace/compare" className="text-emerald underline underline-offset-4">
          Compare
        </Link>{" "}
        tab.
      </p>

      {reviewing && (
        <section aria-label="Review quote" className="rounded-lg border-2 border-forest p-4">
          <QuoteReview
            initial={reviewing}
            onConfirm={(quote) => {
              update((p) => ({ ...p, quotes: p.quotes.map((q) => (q.id === quote.id ? quote : q)) }));
              setReviewing(null);
            }}
            onCancel={() => setReviewing(null)}
          />
        </section>
      )}

      {categories.map((category) => {
        const quotes = plan.quotes.filter((q) => q.category === category);
        const chosenId = plan.decisions.find((d) => d.category === category)?.quoteId;
        return (
          <section key={category} aria-labelledby={`cat-${category}`} className="flex flex-col gap-3">
            <h2 id={`cat-${category}`} className="font-display text-3xl font-semibold text-forest">
              {CATEGORY_LABEL[category]}
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {plan.requirements
                .filter((r) => r.category === category)
                .map((r) => (
                  <RequirementCard key={r.id} requirement={r} city={plan.city} />
                ))}
            </div>
            {quotes.length > 0 && (
              <ul className="flex flex-col gap-2" aria-label={`${CATEGORY_LABEL[category]} quotes`}>
                {quotes.map((q) => (
                  <QuoteRow key={q.id} quote={q} chosen={q.id === chosenId} onReview={() => setReviewing(q)} />
                ))}
              </ul>
            )}
            {intakeFor === category ? (
              <QuoteIntake category={category} onDone={() => setIntakeFor(null)} />
            ) : (
              <Button variant="secondary" className="w-fit" onClick={() => setIntakeFor(category)}>
                Add a {CATEGORY_LABEL[category].toLowerCase()} quote
              </Button>
            )}
          </section>
        );
      })}

      <section aria-labelledby="add-need" className="flex flex-col gap-2">
        <h2 id="add-need" className="font-display text-2xl font-semibold text-forest">
          Need another vendor?
        </h2>
        <AddRequirement />
      </section>
    </>
  );
}
