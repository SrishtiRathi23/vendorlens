"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORY_KEYS, CATEGORY_LABEL, type CategoryKey } from "@/domain/categories";
import { compareQuotes } from "@/domain/compare";
import { chooseQuote } from "@/domain/decision";
import { randomId } from "@/domain/ids";
import { formatINR } from "@/domain/money";
import { type NormalizedQuote, normalizeQuote } from "@/domain/quote-normalize";
import { vendorQuestions } from "@/domain/questions";
import type { EventPlan, Quote } from "@/domain/schemas";
import { CompareTable } from "@/features/compare/CompareTable";
import { usePlanStore } from "@/features/store/plan-store";
import { Badge, Button, Field, inputClass } from "@/ui/controls";
import { Dialog } from "@/ui/Dialog";

/** Everything on this screen is computed locally from confirmed quotes; it never calls the AI. */
function normalizedFor(plan: EventPlan, category: CategoryKey, today: string) {
  const context = { guestCount: plan.guestCount, eventDate: plan.date, today, requirements: plan.requirements };
  return plan.quotes
    .filter((q) => q.category === category && q.confirmed)
    .map((quote) => ({ quote, normalized: normalizeQuote(quote, context) }));
}

export function CompareView() {
  const { plan, today, update } = usePlanStore();
  const withQuotes = plan
    ? CATEGORY_KEYS.filter((key) => plan.quotes.some((q) => q.category === key && q.confirmed))
    : [];
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [choosing, setChoosing] = useState<{ quote: Quote; normalized: NormalizedQuote } | null>(null);
  const [copied, setCopied] = useState("");

  if (!plan || !today) return null;
  const active = category && withQuotes.includes(category) ? category : withQuotes[0];
  const unconfirmed = plan.quotes.filter((q) => !q.confirmed).length;

  if (!active) {
    return (
      <>
        <h1 className="font-display text-4xl font-semibold text-forest">Compare quotes</h1>
        <p>
          No confirmed quotes yet. Add and confirm at least two quotes for a category on the{" "}
          <Link href="/workspace/vendors" className="text-emerald underline underline-offset-4">
            Vendors
          </Link>{" "}
          tab.
        </p>
      </>
    );
  }

  const rows = normalizedFor(plan, active, today);
  const comparison = compareQuotes(rows.map((r) => r.normalized));
  const decision = plan.decisions.find((d) => d.category === active);

  const confirmChoice = () => {
    if (!choosing) return;
    update((p) => chooseQuote(p, choosing.quote.id, choosing.normalized, { today, newId: randomId }));
    setChoosing(null);
  };

  const copy = async (vendor: string, questions: string[]) => {
    await navigator.clipboard.writeText(questions.map((q, i) => `${String(i + 1)}. ${q}`).join("\n"));
    setCopied(`Questions for ${vendor} copied.`);
  };

  return (
    <>
      <h1 className="font-display text-4xl font-semibold text-forest">Compare quotes</h1>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Category">
          {(p) => (
            <select
              {...p}
              className={inputClass}
              value={active}
              onChange={(e) => setCategory(e.target.value as CategoryKey)}
            >
              {withQuotes.map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABEL[key]}
                </option>
              ))}
            </select>
          )}
        </Field>
        {unconfirmed > 0 && (
          <p className="text-sm">
            {unconfirmed} quote{unconfirmed === 1 ? " is" : "s are"} waiting for review on the{" "}
            <Link href="/workspace/vendors" className="text-emerald underline underline-offset-4">
              Vendors
            </Link>{" "}
            tab and {unconfirmed === 1 ? "isn't" : "aren't"} included.
          </p>
        )}
      </div>

      <p role="status" className="rounded-md border-l-4 border-saffron bg-sage px-4 py-3 font-medium text-forest">
        {comparison.verdict}
      </p>
      <CompareTable
        comparison={comparison}
        caption={`${CATEGORY_LABEL[active]} quotes compared for ${String(plan.guestCount)} guests`}
      />

      <section aria-labelledby="questions-heading" className="flex flex-col gap-4">
        <h2 id="questions-heading" className="font-display text-3xl font-semibold text-forest">
          Questions and decision
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ quote, normalized }) => {
            const questions = vendorQuestions(quote, normalized, quote.aiQuestions);
            const isChosen = decision?.quoteId === quote.id;
            return (
              <article key={quote.id} className="flex flex-col gap-3 rounded-lg border border-cream bg-white/60 p-4">
                <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-forest">
                  {quote.vendorAlias}
                  {isChosen && <Badge tone="info">Chosen</Badge>}
                </h3>
                {questions.length === 0 ? (
                  <p className="text-sm">Nothing unclear in this quote.</p>
                ) : (
                  <>
                    <ol className="list-decimal pl-5 text-sm">
                      {questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ol>
                    <Button variant="quiet" className="w-fit" onClick={() => void copy(quote.vendorAlias, questions)}>
                      Copy questions for {quote.vendorAlias}
                    </Button>
                  </>
                )}
                {!isChosen && (
                  <Button className="w-fit" onClick={() => setChoosing({ quote, normalized })}>
                    Choose {quote.vendorAlias}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
        <p role="status" className="text-sm">
          {copied}
        </p>
      </section>

      <Dialog open={choosing !== null} title="Choose this vendor?" onClose={() => setChoosing(null)}>
        {choosing && (
          <>
            <p>
              <strong>{choosing.quote.vendorAlias}</strong>: known total{" "}
              <span className="figures">{formatINR(choosing.normalized.knownTotalPaise)}</span>. This becomes the
              committed amount for {CATEGORY_LABEL[choosing.quote.category].toLowerCase()}, and its payment schedule
              becomes dated tasks.
            </p>
            {choosing.normalized.status !== "comparable" && (
              <div role="alert" className="rounded-md border-2 border-brick p-3">
                <p className="font-medium text-brick">Still unknown or mismatched:</p>
                <ul className="list-disc pl-5 text-sm">
                  {[
                    ...choosing.normalized.unknowns.map((u) => u.label),
                    ...choosing.normalized.missingTags,
                    ...choosing.normalized.mismatches,
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm">The final price may be higher than the known total.</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={confirmChoice}>Choose and update budget</Button>
              <Button variant="secondary" onClick={() => setChoosing(null)}>
                Not yet
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
