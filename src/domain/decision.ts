import type { IsoDate } from "@/domain/dates";
import type { IdFactory } from "@/domain/ids";
import { buildMilestones } from "@/domain/payment-schedule";
import { vendorQuestions } from "@/domain/questions";
import type { NormalizedQuote } from "@/domain/quote-normalize";
import type { EventPlan } from "@/domain/schemas";

/**
 * Records the user's choice of a quote for its category. The category's committed amount becomes
 * the quote's known total (exactly once, replacing any earlier choice), the category's vendor needs
 * are marked decided, and the quote's payment schedule becomes dated payment tasks.
 */
export function chooseQuote(
  event: EventPlan,
  quoteId: string,
  normalized: NormalizedQuote,
  options: { today: IsoDate; newId: IdFactory },
): EventPlan {
  const quote = event.quotes.find((q) => q.id === quoteId);
  if (!quote?.confirmed) return event;
  const { category } = quote;

  const milestones = buildMilestones(
    normalized.knownTotalPaise,
    quote.terms.paymentSchedule,
    event.date,
    options.today,
  );
  const paymentTasks = milestones.map((m) => ({
    id: options.newId(),
    title: `Pay ${quote.vendorAlias}: ${m.label}`,
    category,
    leadDays: null,
    due: m.due,
    doNow: m.due < options.today,
    priority: "high" as const,
    done: false,
    origin: "payment" as const,
    quoteId,
    amountPaise: m.amountPaise,
  }));

  return {
    ...event,
    decisions: [
      ...event.decisions.filter((d) => d.category !== category),
      {
        category,
        quoteId,
        committedPaise: normalized.knownTotalPaise,
        openQuestions: vendorQuestions(quote, normalized),
        decidedOn: options.today,
      },
    ],
    requirements: event.requirements.map((r) =>
      r.category === category ? { ...r, status: "selected", decided: true } : r,
    ),
    tasks: [...event.tasks.filter((t) => !(t.origin === "payment" && t.category === category)), ...paymentTasks],
  };
}

/**
 * Removes a quote. If it was the chosen one, the category's decision and payment tasks go with
 * it and the category's vendor needs become undecided again.
 */
export function removeQuote(event: EventPlan, quoteId: string): EventPlan {
  const quote = event.quotes.find((q) => q.id === quoteId);
  if (!quote) return event;
  const wasChosen = event.decisions.some((d) => d.quoteId === quoteId);
  return {
    ...event,
    quotes: event.quotes.filter((q) => q.id !== quoteId),
    decisions: event.decisions.filter((d) => d.quoteId !== quoteId),
    tasks: event.tasks.filter((t) => t.quoteId !== quoteId),
    requirements: wasChosen
      ? event.requirements.map((r) => (r.category === quote.category ? { ...r, status: "quoted", decided: false } : r))
      : event.requirements,
  };
}
