"use client";

import { useRouter } from "next/navigation";
import { type SyntheticEvent, useRef, useState } from "react";
import { DIET_TAGS, type DietTag, EVENT_KIND_LABEL, EVENT_KINDS, type EventKind, tagLabel } from "@/domain/categories";
import { type EventBrief, EventBriefSchema } from "@/domain/contracts";
import { addDays } from "@/domain/dates";
import { randomId } from "@/domain/ids";
import { parseRupeeInput } from "@/domain/money";
import { buildEventFromDraft } from "@/domain/plan-build";
import { TEMPLATE_DRAFTS } from "@/domain/templates";
import { usePlanStore } from "@/features/store/plan-store";
import { ai } from "@/lib/api";
import { Button, Field, inputClass } from "@/ui/controls";

interface Form {
  kind: EventKind;
  title: string;
  date: string;
  startTime: string;
  city: string;
  guests: string;
  budget: string;
  contingency: string;
  dietary: DietTag[];
  cultureNote: string;
  mustHaves: string;
  brief: string;
}

type Errors = Partial<Record<keyof Form, string>>;

const STEPS = ["The event", "Money", "Preferences"] as const;

function validate(step: number, form: Form, today: string): Errors {
  const errors: Errors = {};
  if (step === 0) {
    if (form.title.trim().length < 2) errors.title = "Give the event a name.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || form.date <= today) errors.date = "Choose a date after today.";
    if (form.city.trim().length < 2) errors.city = "Enter the city or area.";
    const guests = Number(form.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > 100_000)
      errors.guests = "Enter a whole number of guests, from 1 to 1,00,000.";
  }
  if (step === 1) {
    const budget = parseRupeeInput(form.budget);
    if (budget === null || budget < 100_000) errors.budget = "Enter a budget of at least ₹1,000, for example 8,50,000.";
    const contingency = Number(form.contingency);
    if (!Number.isFinite(contingency) || contingency < 0 || contingency > 30)
      errors.contingency = "Use a percentage between 0 and 30.";
  }
  return errors;
}

function toBrief(form: Form): EventBrief | null {
  const parsed = EventBriefSchema.safeParse({
    kind: form.kind,
    title: form.title,
    date: form.date,
    startTime: form.startTime,
    city: form.city,
    guestCount: Number(form.guests),
    budgetPaise: parseRupeeInput(form.budget),
    contingencyBp: Math.round(Number(form.contingency) * 100),
    dietary: form.dietary,
    cultureNote: form.cultureNote,
    mustHaves: form.mustHaves
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8),
    brief: form.brief,
  });
  return parsed.success ? parsed.data : null;
}

/** Three short steps, then Gemini drafts the plan; if AI is unavailable, a labelled template is used. */
export function Wizard() {
  const router = useRouter();
  const { today, replace } = usePlanStore();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "drafting">("idle");
  const summaryRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<Form>({
    kind: "wedding",
    title: "",
    date: "",
    startTime: "18:00",
    city: "",
    guests: "100",
    budget: "",
    contingency: "5",
    dietary: [],
    cultureNote: "",
    mustHaves: "",
    brief: "",
  });

  // Until the organiser picks a date, suggest one three months out (derived, not stored).
  const filled: Form = { ...form, date: form.date || (today ? addDays(today, 90) : "") };

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const showErrors = (next: Errors) => {
    setErrors(next);
    if (Object.keys(next).length > 0) requestAnimationFrame(() => summaryRef.current?.focus());
    return Object.keys(next).length === 0;
  };

  const generate = async () => {
    const brief = toBrief(filled);
    if (!brief || !today) return;
    setStatus("drafting");
    const result = await ai.draft(brief);
    const plan = result.ok
      ? buildEventFromDraft(brief, result.data.draft, { today, origin: "ai", newId: randomId })
      : buildEventFromDraft(brief, TEMPLATE_DRAFTS[brief.kind], { today, origin: "template", newId: randomId });
    replace(result.ok ? { ...plan, assumptions: [...plan.assumptions, ...result.data.notes].slice(0, 10) } : plan);
    router.push("/workspace");
  };

  const onSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!today || !showErrors(validate(step, filled, today))) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else void generate();
  };

  const errorList = Object.entries(errors);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-describedby="wizard-progress">
      <p id="wizard-progress" className="text-sm font-medium text-emerald">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-md border-2 border-brick bg-ivory p-4">
          <h2 className="font-medium text-brick">Please fix {errorList.length === 1 ? "this" : "these"} first:</h2>
          <ul className="mt-2 list-disc pl-5">
            {errorList.map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {step === 0 && (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">The event</legend>
          <Field label="Type of event" className="sm:col-span-2">
            {(p) => (
              <select
                {...p}
                className={inputClass}
                value={form.kind}
                onChange={(e) => set("kind", e.target.value as EventKind)}
              >
                {EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {EVENT_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Event name" error={errors.title} className="sm:col-span-2">
            {(p) => (
              <input
                {...p}
                className={inputClass}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Meera's 30th birthday"
              />
            )}
          </Field>
          <Field label="Date" error={errors.date}>
            {(p) => (
              <input
                {...p}
                type="date"
                className={inputClass}
                value={filled.date}
                onChange={(e) => set("date", e.target.value)}
              />
            )}
          </Field>
          <Field label="Start time" hint="India Standard Time">
            {(p) => (
              <input
                {...p}
                type="time"
                className={inputClass}
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
              />
            )}
          </Field>
          <Field label="City or area" error={errors.city}>
            {(p) => (
              <input
                {...p}
                className={inputClass}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Pune"
              />
            )}
          </Field>
          <Field label="Guests" error={errors.guests}>
            {(p) => (
              <input
                {...p}
                inputMode="numeric"
                className={inputClass}
                value={form.guests}
                onChange={(e) => set("guests", e.target.value)}
              />
            )}
          </Field>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Money</legend>
          <Field label="Total budget (₹)" hint="Indian grouping is fine: 8,50,000" error={errors.budget}>
            {(p) => (
              <input
                {...p}
                inputMode="decimal"
                className={inputClass}
                value={form.budget}
                onChange={(e) => set("budget", e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Contingency (%)"
            hint="Held back for surprises; not allocated to any category"
            error={errors.contingency}
          >
            {(p) => (
              <input
                {...p}
                inputMode="decimal"
                className={inputClass}
                value={form.contingency}
                onChange={(e) => set("contingency", e.target.value)}
              />
            )}
          </Field>
        </fieldset>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-forest">Dietary needs</legend>
            <div className="flex flex-wrap gap-3">
              {DIET_TAGS.map((tag) => (
                <label key={tag} className="flex min-h-11 items-center gap-2 rounded-md border border-cream px-3">
                  <input
                    type="checkbox"
                    checked={form.dietary.includes(tag)}
                    onChange={(e) =>
                      set("dietary", e.target.checked ? [...form.dietary, tag] : form.dietary.filter((t) => t !== tag))
                    }
                  />
                  {tagLabel(tag)}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Culture or traditions (optional)">
            {(p) => (
              <input
                {...p}
                className={inputClass}
                value={form.cultureNote}
                onChange={(e) => set("cultureNote", e.target.value)}
                placeholder="Punjabi wedding with a mehendi"
              />
            )}
          </Field>
          <Field label="Must-haves (optional)" hint="Separate with commas">
            {(p) => (
              <input
                {...p}
                className={inputClass}
                value={form.mustHaves}
                onChange={(e) => set("mustHaves", e.target.value)}
                placeholder="Live music, step-free venue"
              />
            )}
          </Field>
          <Field
            label="Describe your event (optional)"
            hint="This description, without phone numbers or emails, is sent to Google Gemini to draft your plan. Don't include private details."
          >
            {(p) => (
              <textarea
                {...p}
                rows={4}
                maxLength={1500}
                className={inputClass}
                value={form.brief}
                onChange={(e) => set("brief", e.target.value)}
              />
            )}
          </Field>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={status === "drafting"}>
            Back
          </Button>
        )}
        <Button type="submit" disabled={status === "drafting" || !today}>
          {step < STEPS.length - 1 ? "Next" : status === "drafting" ? "Drafting your plan…" : "Generate my plan"}
        </Button>
      </div>
      <p role="status" className="text-sm text-emerald">
        {status === "drafting"
          ? "Gemini is drafting your budget, timeline, vendor checklist and ideas. This takes about ten seconds."
          : ""}
      </p>
    </form>
  );
}
