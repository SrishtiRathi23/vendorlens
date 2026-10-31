import { addDays, daysBetween, type IsoDate } from "@/domain/dates";
import type { EventPlan, Task } from "@/domain/schemas";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

function byDueThenPriority(a: Task, b: Task): number {
  return a.due.localeCompare(b.due) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

/** Days until the event: 0 on the day, negative afterwards. */
export function daysToGo(event: Pick<EventPlan, "date">, today: IsoDate): number {
  return daysBetween(today, event.date);
}

export interface TaskBuckets {
  overdue: Task[];
  thisWeek: Task[];
  later: Task[];
  done: Task[];
}

/** Splits tasks for the reminder lists: overdue, due within 7 days, later, and done. */
export function bucketTasks(tasks: readonly Task[], today: IsoDate): TaskBuckets {
  const weekEnd = addDays(today, 7);
  const sorted = [...tasks].sort(byDueThenPriority);
  return {
    overdue: sorted.filter((t) => !t.done && t.due < today),
    thisWeek: sorted.filter((t) => !t.done && t.due >= today && t.due <= weekEnd),
    later: sorted.filter((t) => !t.done && t.due > weekEnd),
    done: sorted.filter((t) => t.done),
  };
}

/** Vendor needs still to be booked, as dated deadlines for the timeline. */
export function bookingDeadlines(event: EventPlan): { id: string; label: string; bookBy: IsoDate }[] {
  return event.requirements
    .filter((r) => !r.decided)
    .map((r) => ({ id: r.id, label: r.label, bookBy: r.bookBy }))
    .sort((a, b) => a.bookBy.localeCompare(b.bookBy));
}
