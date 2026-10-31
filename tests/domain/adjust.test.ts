import { describe, expect, it } from "vitest";
import { adjustContext, applyAdjustment } from "@/domain/adjust";
import type { AdjustOperationAi } from "@/domain/contracts";
import { diffEvents } from "@/domain/diff";
import { sequentialIds } from "@/domain/ids";
import { buildSampleEvent } from "@/domain/samples";
import { TODAY } from "../helpers/factories";

const blank: AdjustOperationAi = {
  op: "set_guest_count",
  ref: null,
  category: null,
  number: null,
  date: null,
  title: null,
  detail: null,
  priority: null,
  required: null,
  coverageTags: null,
  section: null,
};
const op = (fields: Partial<AdjustOperationAi>): AdjustOperationAi => ({ ...blank, ...fields });

function setup() {
  const event = buildSampleEvent("wedding", TODAY, sequentialIds("e"));
  const decided = {
    ...event,
    requirements: event.requirements.map((r) => (r.category === "catering" ? { ...r, decided: true } : r)),
    allocations: event.allocations.map((a) => (a.category === "venue" ? { ...a, locked: true } : a)),
  };
  const { context, refs } = adjustContext(decided);
  return { event: decided, context, refs };
}

describe("adjustContext", () => {
  it("Q18 · never includes contacts, notes or quote text, and uses short refs", () => {
    const { event } = setup();
    const withContact = {
      ...event,
      requirements: event.requirements.map((r) => ({
        ...r,
        contact: { name: "Ravi", phone: "9876543210", email: "ravi@example.com" },
        notes: "private",
      })),
    };
    const serialized = JSON.stringify(adjustContext(withContact).context);
    for (const secret of ["Ravi", "9876543210", "ravi@example.com", "private", "per plate"])
      expect(serialized).not.toContain(secret);
    expect(adjustContext(withContact).context.requirements[0]?.ref).toBe("R1");
  });
});

describe("applyAdjustment", () => {
  it("Q17 · never changes a decided vendor or a locked allocation, and says why", () => {
    const { event, context, refs } = setup();
    const caterer = context.requirements.find((r) => r.category === "catering");
    const result = applyAdjustment(
      event,
      [
        op({ op: "update_requirement", ref: caterer?.ref ?? null, title: "Cheaper caterer" }),
        op({ op: "set_allocation", category: "venue", number: 1 }),
      ],
      { scope: "plan", refs, today: TODAY, newId: sequentialIds("n") },
    );
    expect(result.event.requirements).toEqual(event.requirements);
    expect(result.event.allocations).toEqual(event.allocations);
    expect(result.skipped.map((s) => s.reason)).toEqual([
      expect.stringContaining("already has a chosen vendor"),
      expect.stringContaining("locked"),
    ]);
  });

  it("applies a guest-count change and new needs, and the diff describes them in words", () => {
    const { event, refs } = setup();
    const result = applyAdjustment(
      event,
      [
        op({ op: "set_guest_count", number: 180 }),
        op({
          op: "add_requirement",
          category: "entertainment",
          title: "DJ for the reception",
          coverageTags: ["dj", "drone"],
          number: 45,
        }),
      ],
      { scope: "plan", refs, today: TODAY, newId: sequentialIds("n") },
    );
    expect(result.skipped).toEqual([]);
    expect(result.event.guestCount).toBe(180);
    const added = result.event.requirements.at(-1);
    expect(added).toMatchObject({ label: "DJ for the reception", coverageTags: ["dj"], decided: false });
    expect(diffEvents(event, result.event).map((c) => c.text)).toEqual([
      "Guests: 150 → 180",
      "Added: DJ for the reception",
    ]);
    expect(event.guestCount).toBe(150); // the original is untouched
  });

  it("drops operations outside the requested scope and invalid values", () => {
    const { event, refs } = setup();
    const result = applyAdjustment(
      event,
      [
        op({ op: "set_budget", number: 5 }),
        op({ op: "add_idea", section: "menu", title: "Jain thali" }),
        op({ op: "set_guest_count", number: 0.5 }),
      ],
      { scope: "ideas", refs, today: TODAY, newId: sequentialIds("n") },
    );
    expect(result.event.ideas.at(-1)?.title).toBe("Jain thali");
    expect(result.skipped).toHaveLength(2);
  });

  it("refuses to remove required needs and payment milestones, and moves dates with the event", () => {
    const { event, context, refs } = setup();
    const optional = context.requirements.find((r) => !r.required && !r.decided);
    const required = context.requirements.find((r) => r.required && !r.decided);
    const result = applyAdjustment(
      event,
      [
        op({ op: "remove_requirement", ref: optional?.ref ?? null }),
        op({ op: "remove_requirement", ref: required?.ref ?? null }),
        op({ op: "set_event_date", date: "2027-04-01" }),
        op({ op: "set_event_date", date: "2020-01-01" }),
        op({ op: "remove_task", ref: "T99" }),
      ],
      { scope: "plan", refs, today: TODAY, newId: sequentialIds("n") },
    );
    expect(result.event.requirements).toHaveLength(event.requirements.length - 1);
    expect(result.event.date).toBe("2027-04-01");
    expect(result.event.requirements.every((r) => r.bookBy >= TODAY)).toBe(true);
    expect(result.skipped).toHaveLength(3);
  });

  it("adds tasks and run-sheet slots and keeps the run sheet in time order", () => {
    const { event, refs } = setup();
    const result = applyAdjustment(
      event,
      [
        op({ op: "add_task", title: "Book mehendi artist", number: 30, priority: "high" }),
        op({ op: "add_day_slot", title: "Mehendi", number: -300, detail: "Artist" }),
      ],
      { scope: "plan", refs, today: TODAY, newId: sequentialIds("n") },
    );
    expect(result.event.tasks.at(-1)).toMatchObject({ title: "Book mehendi artist", origin: "user", priority: "high" });
    expect(result.event.dayOf[0]).toMatchObject({ title: "Mehendi", startMinute: -300 });
  });
});
