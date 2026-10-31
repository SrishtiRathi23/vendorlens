import type { EventKind } from "@/domain/categories";
import type { EventBrief } from "@/domain/contracts";
import { addDays, type IsoDate } from "@/domain/dates";
import type { IdFactory } from "@/domain/ids";
import { buildEventFromDraft } from "@/domain/plan-build";
import type { EventPlan, Quote } from "@/domain/schemas";
import { TEMPLATE_DRAFTS } from "@/domain/templates";

/*
 * Fictional sample events and quotes. Every vendor name here is invented and labelled
 * "(sample)" in the UI; none of these numbers are real prices.
 */

export const SAMPLE_BRIEFS: Record<EventKind, (today: IsoDate) => EventBrief> = {
  wedding: (today) => ({
    kind: "wedding",
    title: "Aarav & Meera's wedding (sample)",
    date: addDays(today, 120),
    startTime: "18:30",
    city: "Jaipur",
    guestCount: 150,
    budgetPaise: 1_500_000_00,
    contingencyBp: 500,
    dietary: ["vegetarian", "jain"],
    cultureNote: "North Indian Hindu wedding with a sangeet the night before.",
    mustHaves: ["Live music at the sangeet"],
    brief: "Two functions, 150 guests, mostly vegetarian with some Jain guests.",
  }),
  birthday: (today) => ({
    kind: "birthday",
    title: "Kabir turns 30 (sample)",
    date: addDays(today, 40),
    startTime: "19:30",
    city: "Pune",
    guestCount: 40,
    budgetPaise: 120_000_00,
    contingencyBp: 500,
    dietary: ["vegetarian", "no_alcohol"],
    cultureNote: "",
    mustHaves: ["Acoustic music"],
    brief: "Rooftop 30th birthday, Goan food, about half the guests vegetarian.",
  }),
  community: (today) => ({
    kind: "community",
    title: "Lakeview Society Diwali mela (sample)",
    date: addDays(today, 60),
    startTime: "17:00",
    city: "Bengaluru",
    guestCount: 300,
    budgetPaise: 200_000_00,
    contingencyBp: 800,
    dietary: ["vegetarian", "nut_free"],
    cultureNote: "Diwali celebration open to all residents.",
    mustHaves: ["Rangoli competition", "First aid desk"],
    brief: "Free community mela with food stalls, a kids' corner and a small stage.",
  }),
};

/** Raw text of two fictional catering quotes, for trying "Extract details with AI". */
export const SAMPLE_QUOTE_TEXTS = {
  offerA: `Shubh Rasoi Caterers (sample)
Wedding dinner package: Rs. 850/- per plate, minimum 100 plates.
Menu: 2 starters, 3 mains, dal, rice, 2 breads, 1 dessert.
Crockery and buffet counters included.
Service staff on actuals. Transport extra as applicable.
Taxes as applicable.
50% advance to confirm the booking, balance on the event day.
Quote valid till 30 November.`,
  offerB: `Annapurna Feasts (sample)
Wedding dinner for 150 guests at ₹980 per plate.
Includes 12 service staff, crockery, live chaat counter and delivery to the venue.
GST 5% extra on the total.
Payment: 50% on booking, 30% 7 days before the event, 20% on the event day.
Advance is non-refundable after booking.`,
};

/** The same two quotes as reviewed, confirmed data: one complete, one with honest unknowns. */
function sampleCateringQuotes(newId: IdFactory): Quote[] {
  const base = {
    category: "catering" as const,
    sourceType: "sample" as const,
    provenance: {},
    evidence: {},
    aiQuestions: [],
    confirmed: true,
  };
  return [
    {
      ...base,
      id: newId(),
      vendorAlias: "Shubh Rasoi Caterers (sample)",
      sourceText: SAMPLE_QUOTE_TEXTS.offerA,
      lines: [
        {
          id: newId(),
          description: "Wedding dinner per plate",
          basis: "per_guest",
          unitPaise: 850_00,
          quantity: null,
          mandatory: true,
        },
      ],
      inclusions: ["crockery"],
      exclusions: ["Service staff on actuals", "Transport extra"],
      terms: {
        taxMode: "unknown",
        taxRateBp: null,
        statedTaxPaise: null,
        transport: { state: "unknown" },
        staffing: { state: "unknown" },
        setup: { state: "included" },
        paymentSchedule: [
          { shareBp: 5_000, when: "on_booking", days: null },
          { shareBp: 5_000, when: "event_day", days: null },
        ],
        depositRefundable: "unknown",
        cancellation: "",
        validUntil: null,
      },
      guestCountAssumed: null,
    },
    {
      ...base,
      id: newId(),
      vendorAlias: "Annapurna Feasts (sample)",
      sourceText: SAMPLE_QUOTE_TEXTS.offerB,
      lines: [
        {
          id: newId(),
          description: "Wedding dinner per plate",
          basis: "per_guest",
          unitPaise: 980_00,
          quantity: null,
          mandatory: true,
        },
      ],
      inclusions: ["service_staff", "crockery", "live_counter", "transport"],
      exclusions: [],
      terms: {
        taxMode: "exclusive_known",
        taxRateBp: 500,
        statedTaxPaise: null,
        transport: { state: "included" },
        staffing: { state: "included" },
        setup: { state: "included" },
        paymentSchedule: [
          { shareBp: 5_000, when: "on_booking", days: null },
          { shareBp: 3_000, when: "days_before", days: 7 },
          { shareBp: 2_000, when: "event_day", days: null },
        ],
        depositRefundable: "no",
        cancellation: "Advance is non-refundable after booking.",
        validUntil: null,
      },
      guestCountAssumed: 150,
    },
  ];
}

/** A ready-made sample plan built from the template, so the whole app can be explored without AI. */
export function buildSampleEvent(kind: EventKind, today: IsoDate, newId: IdFactory): EventPlan {
  const event = buildEventFromDraft(SAMPLE_BRIEFS[kind](today), TEMPLATE_DRAFTS[kind], {
    today,
    origin: "sample",
    newId,
  });
  return kind === "wedding" ? { ...event, quotes: sampleCateringQuotes(newId) } : event;
}
