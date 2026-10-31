import { CATEGORY_LABEL } from "@/domain/categories";
import { formatDate } from "@/domain/dates";
import { formatINR } from "@/domain/money";
import type { EventPlan } from "@/domain/schemas";

export interface Change {
  area: "Event" | "Budget" | "Vendors" | "Timeline" | "Ideas" | "Day-of";
  kind: "added" | "removed" | "changed";
  /** Plain-language description, readable by a screen reader without any colour cue. */
  text: string;
}

function diffCollection<T extends { id: string }>(
  area: Change["area"],
  before: readonly T[],
  after: readonly T[],
  name: (item: T) => string,
): Change[] {
  const old = new Map(before.map((item) => [item.id, item]));
  const now = new Map(after.map((item) => [item.id, item]));
  const changes: Change[] = [];
  for (const [id, item] of now) {
    const prev = old.get(id);
    if (!prev) changes.push({ area, kind: "added", text: `Added: ${name(item)}` });
    else if (JSON.stringify(prev) !== JSON.stringify(item))
      changes.push({ area, kind: "changed", text: `Updated: ${name(item)}` });
  }
  for (const [id, item] of old) {
    if (!now.has(id)) changes.push({ area, kind: "removed", text: `Removed: ${name(item)}` });
  }
  return changes;
}

/** Lists every difference between two versions of a plan, for the before/after preview. */
export function diffEvents(before: EventPlan, after: EventPlan): Change[] {
  const changes: Change[] = [];
  const changed = (area: Change["area"], text: string) => changes.push({ area, kind: "changed", text });

  if (before.guestCount !== after.guestCount)
    changed("Event", `Guests: ${String(before.guestCount)} → ${String(after.guestCount)}`);
  if (before.date !== after.date) changed("Event", `Date: ${formatDate(before.date)} → ${formatDate(after.date)}`);
  if (before.budgetPaise !== after.budgetPaise) {
    changed("Budget", `Total budget: ${formatINR(before.budgetPaise)} → ${formatINR(after.budgetPaise)}`);
  }
  for (const next of after.allocations) {
    const prev = before.allocations.find((a) => a.category === next.category);
    if (prev && prev.allocatedPaise !== next.allocatedPaise) {
      changed(
        "Budget",
        `${CATEGORY_LABEL[next.category]}: ${formatINR(prev.allocatedPaise)} → ${formatINR(next.allocatedPaise)}`,
      );
    }
  }

  return [
    ...changes,
    ...diffCollection("Vendors", before.requirements, after.requirements, (r) => r.label),
    ...diffCollection("Timeline", before.tasks, after.tasks, (t) => t.title),
    ...diffCollection("Ideas", before.ideas, after.ideas, (i) => i.title),
    ...diffCollection("Day-of", before.dayOf, after.dayOf, (d) => d.title),
  ];
}
