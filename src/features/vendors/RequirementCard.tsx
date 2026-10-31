"use client";

import { googleCalendarLink } from "@/domain/calendar";
import { tagLabel } from "@/domain/categories";
import { formatDate } from "@/domain/dates";
import { mapsSearchLink } from "@/domain/links";
import type { Requirement, RequirementStatus } from "@/domain/schemas";
import { usePlanStore } from "@/features/store/plan-store";
import { Badge, Field, inputClass } from "@/ui/controls";

const STATUSES: { value: RequirementStatus; label: string }[] = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "enquired", label: "Enquired" },
  { value: "quoted", label: "Quote received" },
  { value: "selected", label: "Vendor chosen (pending)" },
  { value: "confirmed", label: "Booking confirmed" },
];

/** One vendor need: why it matters, what to ask, its book-by date, status and private contact notes. */
export function RequirementCard({ requirement, city }: { requirement: Requirement; city: string }) {
  const { update } = usePlanStore();
  const patch = (changes: Partial<Requirement>) =>
    update((plan) => ({
      ...plan,
      requirements: plan.requirements.map((r) => (r.id === requirement.id ? { ...r, ...changes } : r)),
    }));

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-cream bg-white/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-forest">{requirement.label}</h3>
        <div className="flex flex-wrap gap-1">
          <Badge tone={requirement.required ? "info" : "neutral"}>
            {requirement.required ? "Required" : "Optional"}
          </Badge>
          <Badge tone={requirement.priority === "high" ? "warn" : "neutral"}>{requirement.priority} priority</Badge>
          {requirement.decided && <Badge tone="good">Vendor chosen</Badge>}
        </div>
      </div>
      {requirement.why && <p className="text-sm">{requirement.why}</p>}
      <p className="text-sm">
        <span className="font-medium">Book by:</span> {formatDate(requirement.bookBy)}{" "}
        <a
          className="text-emerald underline underline-offset-4"
          href={googleCalendarLink(`Book: ${requirement.label}`, requirement.bookBy)}
          target="_blank"
          rel="noopener noreferrer"
        >
          add to Google Calendar<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
      {requirement.coverageTags.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">Quotes should cover:</span> {requirement.coverageTags.map(tagLabel).join(", ")}
        </p>
      )}
      {requirement.questions.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-emerald">Questions to ask</summary>
          <ul className="list-disc pl-5 text-sm">
            {requirement.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          {(p) => (
            <select
              {...p}
              className={inputClass}
              value={requirement.status}
              onChange={(e) => patch({ status: e.target.value as RequirementStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <a
          className="inline-flex min-h-11 items-center self-end text-sm text-emerald underline underline-offset-4"
          href={mapsSearchLink(requirement.label, city)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Find vendors near {city} on Google Maps<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-emerald">
          Contact and notes (stay in this browser)
        </summary>
        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          {(["name", "phone", "email"] as const).map((key) => (
            <Field key={key} label={key === "name" ? "Contact name" : key === "phone" ? "Phone" : "Email"}>
              {(p) => (
                <input
                  {...p}
                  type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                  className={inputClass}
                  defaultValue={requirement.contact[key]}
                  maxLength={key === "email" ? 120 : 80}
                  onBlur={(e) => patch({ contact: { ...requirement.contact, [key]: e.target.value.trim() } })}
                />
              )}
            </Field>
          ))}
          <Field label="Notes" className="sm:col-span-3">
            {(p) => (
              <textarea
                {...p}
                rows={2}
                maxLength={1000}
                className={inputClass}
                defaultValue={requirement.notes}
                onBlur={(e) => patch({ notes: e.target.value })}
              />
            )}
          </Field>
        </div>
      </details>
    </article>
  );
}
