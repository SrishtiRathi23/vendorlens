import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { summarizeBudget } from "@/domain/budget";
import { chooseQuote } from "@/domain/decision";
import { sequentialIds } from "@/domain/ids";
import { sumPaise } from "@/domain/money";
import { buildMilestones, scheduleIsComplete } from "@/domain/payment-schedule";
import { normalizeQuote } from "@/domain/quote-normalize";
import { buildSampleEvent } from "@/domain/samples";
import { TODAY } from "../helpers/factories";

const shares = fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }).map((weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  const bps = weights.map((w) => Math.floor((w * 10_000) / total));
  bps[0] = (bps[0] ?? 0) + 10_000 - bps.reduce((a, b) => a + b, 0);
  return bps.filter((bp) => bp > 0).map((shareBp) => ({ shareBp, when: "days_before" as const, days: 3 }));
});

describe("payment milestones", () => {
  it("Q04 · milestones always add up to the known total exactly; the advance is never added on top", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000_000 }), shares, (total, schedule) => {
        const milestones = buildMilestones(total, schedule, "2027-02-14", TODAY);
        expect(sumPaise(milestones.map((m) => m.amountPaise))).toBe(total);
      }),
    );
  });

  it("falls back to one full payment when the schedule doesn't add up to 100%", () => {
    const partial = [{ shareBp: 5_000, when: "on_booking" as const, days: null }];
    expect(scheduleIsComplete(partial)).toBe(false);
    expect(buildMilestones(1_000, partial, "2027-02-14", TODAY)).toEqual([
      { label: "Pay in full (no agreed schedule)", amountPaise: 1_000, due: "2027-02-14" },
    ]);
  });
});

describe("chooseQuote", () => {
  const event = buildSampleEvent("wedding", TODAY, sequentialIds("w"));
  const offerB = event.quotes[1];
  if (!offerB) throw new Error("sample quote missing");
  const context = {
    guestCount: event.guestCount,
    eventDate: event.date,
    today: TODAY,
    requirements: event.requirements,
  };
  const normalized = normalizeQuote(offerB, context);

  it("Q14 · commits the known total exactly once and creates dated payment tasks", () => {
    const chosen = chooseQuote(event, offerB.id, normalized, { today: TODAY, newId: sequentialIds("c") });
    const again = chooseQuote(chosen, offerB.id, normalized, { today: TODAY, newId: sequentialIds("d") });

    for (const plan of [chosen, again]) {
      expect(plan.decisions.filter((d) => d.category === "catering")).toHaveLength(1);
      const payments = plan.tasks.filter((t) => t.origin === "payment");
      expect(payments).toHaveLength(3);
      expect(sumPaise(payments.map((t) => t.amountPaise ?? 0))).toBe(normalized.knownTotalPaise);
    }
    expect(summarizeBudget(again).committedPaise).toBe(normalized.knownTotalPaise);
    expect(chosen.requirements.filter((r) => r.category === "catering").every((r) => r.decided)).toBe(true);
  });

  it("counts payments as paid only once they are ticked off", () => {
    const chosen = chooseQuote(event, offerB.id, normalized, { today: TODAY, newId: sequentialIds("p") });
    const firstPaid = {
      ...chosen,
      tasks: chosen.tasks.map((t, i, all) =>
        t === all.find((x) => x.origin === "payment") ? { ...t, done: true } : t,
      ),
    };
    const catering = summarizeBudget(firstPaid).categories.find((c) => c.category === "catering");
    expect(catering?.paidPaise).toBe(Math.floor((normalized.knownTotalPaise * 5_000) / 10_000));
    expect(catering?.source).toBe("quote");
  });

  it("ignores unconfirmed or unknown quotes", () => {
    const unconfirmed = { ...event, quotes: event.quotes.map((q) => ({ ...q, confirmed: false })) };
    expect(chooseQuote(unconfirmed, offerB.id, normalized, { today: TODAY, newId: sequentialIds() })).toBe(unconfirmed);
    expect(chooseQuote(event, "missing", normalized, { today: TODAY, newId: sequentialIds() })).toBe(event);
  });
});
