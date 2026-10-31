import { allocate } from "@/domain/allocation";
import { addDays, type IsoDate } from "@/domain/dates";
import type { Paise } from "@/domain/money";
import type { QuoteTerms } from "@/domain/schemas";

export interface Milestone {
  label: string;
  amountPaise: Paise;
  due: IsoDate;
}

type Schedule = QuoteTerms["paymentSchedule"];

/** A schedule is usable only when its shares add up to exactly 100%. */
export function scheduleIsComplete(schedule: Schedule): boolean {
  return schedule.length > 0 && schedule.reduce((sum, step) => sum + step.shareBp, 0) === 10_000;
}

/**
 * Turns "50% on booking, 30% a week before, 20% on the day" into dated payments whose amounts add
 * up to the known total **exactly**. An advance is part of the total, never added on top of it.
 */
export function buildMilestones(total: Paise, schedule: Schedule, eventDate: IsoDate, bookedOn: IsoDate): Milestone[] {
  if (!scheduleIsComplete(schedule))
    return [{ label: "Pay in full (no agreed schedule)", amountPaise: total, due: eventDate }];
  const amounts = allocate(
    total,
    schedule.map((step) => step.shareBp),
  );
  return schedule.map((step, index) => {
    const share = `${String(step.shareBp / 100)}%`;
    switch (step.when) {
      case "on_booking":
        return { label: `${share} advance on booking`, amountPaise: amounts[index] ?? 0, due: bookedOn };
      case "days_before":
        return {
          label: `${share} ${String(step.days ?? 0)} days before the event`,
          amountPaise: amounts[index] ?? 0,
          due: addDays(eventDate, -(step.days ?? 0)),
        };
      case "event_day":
        return { label: `${share} on the event day`, amountPaise: amounts[index] ?? 0, due: eventDate };
      case "after_event":
        return {
          label: `${share} after the event`,
          amountPaise: amounts[index] ?? 0,
          due: addDays(eventDate, step.days ?? 7),
        };
    }
  });
}
