"use client";

import { useState } from "react";
import { CATEGORY_LABEL, COVERAGE_TAGS, tagLabel } from "@/domain/categories";
import { isIsoDate } from "@/domain/dates";
import { randomId } from "@/domain/ids";
import { formatINR, parseRupeeInput } from "@/domain/money";
import { scheduleIsComplete } from "@/domain/payment-schedule";
import type { CostTerm, Quote, QuoteLine, QuoteTerms } from "@/domain/schemas";
import { ProvenanceNote } from "@/features/vendors/ProvenanceNote";
import { Button, Field, inputClass } from "@/ui/controls";

const rupees = (paise: number | null) => (paise === null ? "" : formatINR(paise).replace("₹", ""));
type CostKey = "transport" | "staffing" | "setup";
const COST_TERMS: { key: CostKey; label: string }[] = [
  { key: "transport", label: "Transport or delivery" },
  { key: "staffing", label: "Service staff" },
  { key: "setup", label: "Setup and clearing" },
];

/**
 * Review screen: the pasted quote beside every extracted value and its evidence. Editing a value
 * marks it "You entered this". Only a confirmed quote is ever used in a comparison.
 */
export function QuoteReview({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: Quote;
  onConfirm: (quote: Quote) => void;
  onCancel: () => void;
}) {
  const [quote, setQuote] = useState(initial);
  const [problems, setProblems] = useState<string[]>([]);

  const edit = (path: string, change: (q: Quote) => Quote) =>
    setQuote((q) => ({ ...change(q), provenance: { ...q.provenance, [path]: "user_confirmed" } }));
  const setTerms = (path: string, terms: Partial<QuoteTerms>) =>
    edit(path, (q) => ({ ...q, terms: { ...q.terms, ...terms } }));
  const setLine = (index: number, patch: Partial<QuoteLine>) =>
    edit(`lines.${String(index)}`, (q) => ({
      ...q,
      lines: q.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));

  const confirm = () => {
    const issues: string[] = [];
    if (!quote.vendorAlias.trim()) issues.push("Give the vendor a name.");
    if (quote.lines.length === 0 || quote.lines.some((l) => !l.description.trim()))
      issues.push("Every price line needs a description.");
    if (quote.terms.paymentSchedule.length > 0 && !scheduleIsComplete(quote.terms.paymentSchedule))
      issues.push("Payment shares must add up to exactly 100%.");
    setProblems(issues);
    if (issues.length === 0) onConfirm({ ...quote, vendorAlias: quote.vendorAlias.trim(), confirmed: true });
  };

  const note = (path: string) => <ProvenanceNote state={quote.provenance[path]} excerpt={quote.evidence[path]} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="source-heading" className="flex flex-col gap-2">
        <h3 id="source-heading" className="font-medium text-forest">
          {quote.sourceText ? "The quote you pasted" : "Manual entry"}
        </h3>
        {quote.sourceText ? (
          <pre
            tabIndex={0}
            aria-label="Pasted quote text"
            className="max-h-[32rem] overflow-auto rounded-md border border-cream bg-white/70 p-3 text-sm whitespace-pre-wrap"
          >
            {quote.sourceText}
          </pre>
        ) : (
          <p className="text-sm">
            Enter the terms as the vendor gave them. Leave anything you don&apos;t know as unknown; it will never be
            counted as ₹0.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-5">
        <Field label="Vendor name">
          {(p) => (
            <input
              {...p}
              className={inputClass}
              value={quote.vendorAlias}
              onChange={(e) => edit("vendorAlias", (q) => ({ ...q, vendorAlias: e.target.value }))}
            />
          )}
        </Field>
        {note("vendorAlias")}

        <fieldset className="flex flex-col gap-3">
          <legend className="font-medium text-forest">Prices</legend>
          {quote.lines.map((line, index) => (
            <div key={line.id} className="grid gap-2 rounded-md border border-cream p-3 sm:grid-cols-2">
              <Field label={`Item ${String(index + 1)}`} className="sm:col-span-2">
                {(p) => (
                  <input
                    {...p}
                    className={inputClass}
                    value={line.description}
                    onChange={(e) => setLine(index, { description: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Priced">
                {(p) => (
                  <select
                    {...p}
                    className={inputClass}
                    value={line.basis}
                    onChange={(e) => setLine(index, { basis: e.target.value as QuoteLine["basis"] })}
                  >
                    <option value="per_guest">per guest (uses your guest count)</option>
                    <option value="flat">flat</option>
                    <option value="per_hour">per hour</option>
                    <option value="per_unit">per unit</option>
                  </select>
                )}
              </Field>
              <Field label="Rate (₹)" hint="Leave empty if not stated">
                {(p) => (
                  <input
                    {...p}
                    inputMode="decimal"
                    className={inputClass}
                    defaultValue={rupees(line.unitPaise)}
                    onBlur={(e) => setLine(index, { unitPaise: parseRupeeInput(e.target.value) })}
                  />
                )}
              </Field>
              {(line.basis === "per_hour" || line.basis === "per_unit") && (
                <Field label="Quantity">
                  {(p) => (
                    <input
                      {...p}
                      inputMode="numeric"
                      className={inputClass}
                      defaultValue={line.quantity ?? ""}
                      onBlur={(e) =>
                        setLine(index, { quantity: /^\d+$/.test(e.target.value) ? Number(e.target.value) : null })
                      }
                    />
                  )}
                </Field>
              )}
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={line.mandatory}
                  onChange={(e) => setLine(index, { mandatory: e.target.checked })}
                />
                Required for the event
              </label>
              <div className="sm:col-span-2">{note(`lines.${String(index)}`)}</div>
              <Button
                variant="quiet"
                className="w-fit"
                onClick={() => edit("lines", (q) => ({ ...q, lines: q.lines.filter((l) => l.id !== line.id) }))}
              >
                Remove item {index + 1}
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            className="w-fit"
            onClick={() =>
              edit("lines", (q) => ({
                ...q,
                lines: [
                  ...q.lines,
                  { id: randomId(), description: "", basis: "flat", unitPaise: null, quantity: null, mandatory: true },
                ],
              }))
            }
          >
            Add a price line
          </Button>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium text-forest">Included in the price ({CATEGORY_LABEL[quote.category]})</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {COVERAGE_TAGS[quote.category].map((tag) => (
              <div key={tag} className="flex flex-col">
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={quote.inclusions.includes(tag)}
                    onChange={(e) =>
                      edit(`inclusions.${tag}`, (q) => ({
                        ...q,
                        inclusions: e.target.checked ? [...q.inclusions, tag] : q.inclusions.filter((t) => t !== tag),
                      }))
                    }
                  />
                  {tagLabel(tag)}
                </label>
                {note(`inclusions.${tag}`)}
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="font-medium text-forest">Tax (GST)</legend>
          <Field label="Tax in this quote">
            {(p) => (
              <select
                {...p}
                className={inputClass}
                value={quote.terms.taxMode}
                onChange={(e) => setTerms("terms.tax", { taxMode: e.target.value as QuoteTerms["taxMode"] })}
              >
                <option value="included">Included in the prices</option>
                <option value="exclusive_known">Extra, rate or amount stated</option>
                <option value="exclusive_unknown">Extra, amount not stated</option>
                <option value="unknown">Not mentioned</option>
              </select>
            )}
          </Field>
          {quote.terms.taxMode === "exclusive_known" && (
            <>
              <Field label="Rate (%)">
                {(p) => (
                  <input
                    {...p}
                    inputMode="decimal"
                    className={inputClass}
                    defaultValue={quote.terms.taxRateBp === null ? "" : String(quote.terms.taxRateBp / 100)}
                    onBlur={(e) =>
                      setTerms("terms.tax", {
                        taxRateBp: /^\d+(\.\d{1,2})?$/.test(e.target.value)
                          ? Math.round(Number(e.target.value) * 100)
                          : null,
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Or stated amount (₹)">
                {(p) => (
                  <input
                    {...p}
                    inputMode="decimal"
                    className={inputClass}
                    defaultValue={rupees(quote.terms.statedTaxPaise)}
                    onBlur={(e) => setTerms("terms.tax", { statedTaxPaise: parseRupeeInput(e.target.value) })}
                  />
                )}
              </Field>
            </>
          )}
          <div className="sm:col-span-3">{note("terms.tax")}</div>
        </fieldset>

        {COST_TERMS.map(({ key, label }) => (
          <CostTermField
            key={key}
            label={label}
            term={quote.terms[key]}
            onChange={(term) => setTerms(`terms.${key}`, { [key]: term })}
            note={note(`terms.${key}`)}
          />
        ))}

        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium text-forest">Payment schedule</legend>
          {quote.terms.paymentSchedule.map((step, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-4 sm:items-end">
              <Field label={`Share ${String(index + 1)} (%)`}>
                {(p) => (
                  <input
                    {...p}
                    inputMode="decimal"
                    className={inputClass}
                    defaultValue={String(step.shareBp / 100)}
                    onBlur={(e) =>
                      setTerms(`terms.paymentSchedule.${String(index)}`, {
                        paymentSchedule: quote.terms.paymentSchedule.map((s, i) =>
                          i === index
                            ? { ...s, shareBp: Math.max(1, Math.round(Number(e.target.value) * 100) || 1) }
                            : s,
                        ),
                      })
                    }
                  />
                )}
              </Field>
              <Field label="When">
                {(p) => (
                  <select
                    {...p}
                    className={inputClass}
                    value={step.when}
                    onChange={(e) =>
                      setTerms(`terms.paymentSchedule.${String(index)}`, {
                        paymentSchedule: quote.terms.paymentSchedule.map((s, i) =>
                          i === index ? { ...s, when: e.target.value as typeof s.when } : s,
                        ),
                      })
                    }
                  >
                    <option value="on_booking">On booking</option>
                    <option value="days_before">Days before the event</option>
                    <option value="event_day">On the event day</option>
                    <option value="after_event">After the event</option>
                  </select>
                )}
              </Field>
              {step.when === "days_before" && (
                <Field label="Days before">
                  {(p) => (
                    <input
                      {...p}
                      inputMode="numeric"
                      className={inputClass}
                      defaultValue={step.days ?? ""}
                      onBlur={(e) =>
                        setTerms(`terms.paymentSchedule.${String(index)}`, {
                          paymentSchedule: quote.terms.paymentSchedule.map((s, i) =>
                            i === index ? { ...s, days: Number(e.target.value) || 0 } : s,
                          ),
                        })
                      }
                    />
                  )}
                </Field>
              )}
              <Button
                variant="quiet"
                onClick={() =>
                  setTerms("terms.paymentSchedule", {
                    paymentSchedule: quote.terms.paymentSchedule.filter((_, i) => i !== index),
                  })
                }
              >
                Remove share {index + 1}
              </Button>
              <div className="sm:col-span-4">{note(`terms.paymentSchedule.${String(index)}`)}</div>
            </div>
          ))}
          <Button
            variant="secondary"
            className="w-fit"
            onClick={() =>
              setTerms("terms.paymentSchedule", {
                paymentSchedule: [...quote.terms.paymentSchedule, { shareBp: 10_000, when: "on_booking", days: null }],
              })
            }
          >
            Add a payment share
          </Button>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Advance refundable?">
            {(p) => (
              <select
                {...p}
                className={inputClass}
                value={quote.terms.depositRefundable}
                onChange={(e) =>
                  setTerms("terms.depositRefundable", {
                    depositRefundable: e.target.value as QuoteTerms["depositRefundable"],
                  })
                }
              >
                <option value="unknown">Not stated</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            )}
          </Field>
          <Field label="Valid until">
            {(p) => (
              <input
                {...p}
                type="date"
                className={inputClass}
                value={quote.terms.validUntil ?? ""}
                onChange={(e) =>
                  setTerms("terms.validUntil", { validUntil: isIsoDate(e.target.value) ? e.target.value : null })
                }
              />
            )}
          </Field>
          <Field label="Guests the quote assumes" hint="Leave empty if not stated">
            {(p) => (
              <input
                {...p}
                inputMode="numeric"
                className={inputClass}
                defaultValue={quote.guestCountAssumed ?? ""}
                onBlur={(e) =>
                  edit("guestCountAssumed", (q) => ({
                    ...q,
                    guestCountAssumed: /^[1-9]\d*$/.test(e.target.value) ? Number(e.target.value) : null,
                  }))
                }
              />
            )}
          </Field>
          <div className="sm:col-span-3 grid gap-2 sm:grid-cols-3">
            {note("terms.depositRefundable")}
            {note("terms.validUntil")}
            {note("guestCountAssumed")}
          </div>
        </div>

        {problems.length > 0 && (
          <ul role="alert" className="list-disc rounded-md border-2 border-brick p-3 pl-8 text-brick">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-3">
          <Button onClick={confirm}>Confirm quote</Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * A cost term editor. Choosing "Extra, amount stated" keeps the cost **unknown** until a valid
 * amount is typed, so an empty box can never become ₹0.
 */
function CostTermField({
  label,
  term,
  onChange,
  note,
}: {
  label: string;
  term: CostTerm;
  onChange: (term: CostTerm) => void;
  note: React.ReactNode;
}) {
  const [mode, setMode] = useState<CostTerm["state"]>(term.state);
  return (
    <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
      <Field label={label}>
        {(p) => (
          <select
            {...p}
            className={inputClass}
            value={mode}
            onChange={(e) => {
              const next = e.target.value as CostTerm["state"];
              setMode(next);
              onChange(next === "amount" ? { state: "unknown" } : { state: next });
            }}
          >
            <option value="unknown">Not stated (unknown)</option>
            <option value="included">Included</option>
            <option value="amount">Extra, amount stated</option>
            <option value="not_applicable">Not needed</option>
          </select>
        )}
      </Field>
      {mode === "amount" && (
        <Field label={`${label} charge (₹)`} hint="Stays unknown until you enter an amount">
          {(p) => (
            <input
              {...p}
              inputMode="decimal"
              className={inputClass}
              defaultValue={term.state === "amount" ? rupees(term.paise) : ""}
              onBlur={(e) => {
                const paise = parseRupeeInput(e.target.value);
                onChange(paise === null ? { state: "unknown" } : { state: "amount", paise });
              }}
            />
          )}
        </Field>
      )}
      <div className="sm:col-span-2">{note}</div>
    </div>
  );
}
