"use client";

import { type SyntheticEvent, useState } from "react";
import { googleCalendarLink } from "@/domain/calendar";
import { PRIORITIES, type Priority } from "@/domain/categories";
import { clockLabel, daysBetween, formatDate, isIsoDate } from "@/domain/dates";
import { randomId } from "@/domain/ids";
import { formatINR } from "@/domain/money";
import type { Task } from "@/domain/schemas";
import { bookingDeadlines, bucketTasks, daysToGo } from "@/domain/timeline";
import { usePlanStore } from "@/features/store/plan-store";
import { downloadCalendar } from "@/lib/download";
import { Badge, Button, Field, inputClass } from "@/ui/controls";

function TaskItem({ task, overdue }: { task: Task; overdue: boolean }) {
  const { update } = usePlanStore();
  const toggle = () =>
    update((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)) }));
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 p-3">
      <label className="flex min-h-11 flex-1 items-start gap-3">
        <input type="checkbox" className="mt-1" checked={task.done} onChange={toggle} />
        <span className={task.done ? "line-through" : ""}>
          {task.title}
          {task.amountPaise !== null && <span className="figures ml-1">({formatINR(task.amountPaise)})</span>}
          <span className="mt-1 flex flex-wrap gap-1">
            <Badge tone={task.priority === "high" ? "warn" : "neutral"}>{task.priority} priority</Badge>
            {task.doNow && !task.done && <Badge tone="bad">Do now</Badge>}
            {overdue && <Badge tone="bad">Overdue</Badge>}
            {task.origin === "payment" && <Badge tone="info">Payment</Badge>}
          </span>
        </span>
      </label>
      <span className="flex flex-col items-end gap-1 text-sm">
        <span>{formatDate(task.due)}</span>
        {!task.done && (
          <a
            className="text-emerald underline underline-offset-4"
            href={googleCalendarLink(task.title, task.due)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Calendar<span className="sr-only"> for “{task.title}” (opens in a new tab)</span>
          </a>
        )}
      </span>
    </li>
  );
}

function TaskList({ title, tasks, today }: { title: string; tasks: Task[]; today: string }) {
  if (tasks.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="font-display text-2xl font-semibold text-forest">
        {title} <span className="figures text-base font-normal">({tasks.length})</span>
      </h2>
      <ul className="divide-y divide-cream rounded-lg border border-cream bg-white/60">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} overdue={!task.done && task.due < today} />
        ))}
      </ul>
    </section>
  );
}

function AddTask({ eventDate }: { eventDate: string }) {
  const { update, today } = usePlanStore();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const add = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!title.trim() || !isIsoDate(due) || !today) return;
    update((p) => ({
      ...p,
      tasks: [
        ...p.tasks,
        {
          id: randomId(),
          title: title.trim(),
          category: null,
          leadDays: Math.max(0, daysBetween(due, eventDate)),
          due,
          doNow: false,
          priority,
          done: false,
          origin: "user",
          quoteId: null,
          amountPaise: null,
        },
      ],
    }));
    setTitle("");
  };

  return (
    <form
      onSubmit={add}
      className="grid gap-3 rounded-lg border border-dashed border-forest/40 p-4 sm:grid-cols-[1fr_11rem_9rem_auto] sm:items-end print:hidden"
    >
      <Field label="New task">
        {(p) => (
          <input
            {...p}
            className={inputClass}
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
      </Field>
      <Field label="Due">
        {(p) => (
          <input {...p} type="date" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} />
        )}
      </Field>
      <Field label="Priority">
        {(p) => (
          <select
            {...p}
            className={inputClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Button type="submit" disabled={!title.trim() || !isIsoDate(due)}>
        Add task
      </Button>
    </form>
  );
}

export function TimelineView() {
  const { plan, today } = usePlanStore();
  if (!plan || !today) return null;
  const buckets = bucketTasks(plan.tasks, today);
  const days = daysToGo(plan, today);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-semibold text-forest">Timeline</h1>
        <Button variant="secondary" onClick={() => downloadCalendar(plan)} className="print:hidden">
          Download all as .ics
        </Button>
      </div>
      <p className="figures text-xl font-medium text-forest">
        {days >= 0 ? `${String(days)} days to ${plan.title}` : `${plan.title} was ${String(-days)} days ago`} ·{" "}
        {formatDate(plan.date)}
      </p>

      <TaskList title="Overdue" tasks={buckets.overdue} today={today} />
      <TaskList title="Due this week" tasks={buckets.thisWeek} today={today} />
      <TaskList title="Coming up" tasks={buckets.later} today={today} />
      <AddTask eventDate={plan.date} />
      <TaskList title="Done" tasks={buckets.done} today={today} />

      <section aria-labelledby="booking-heading" className="flex flex-col gap-2">
        <h2 id="booking-heading" className="font-display text-2xl font-semibold text-forest">
          Booking deadlines
        </h2>
        <ul className="divide-y divide-cream rounded-lg border border-cream">
          {bookingDeadlines(plan).map((d) => (
            <li key={d.id} className="flex justify-between gap-2 p-3">
              <span>{d.label}</span>
              <span className={d.bookBy <= today ? "font-medium text-brick" : ""}>{formatDate(d.bookBy)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dayof-heading" className="flex flex-col gap-2">
        <h2 id="dayof-heading" className="font-display text-2xl font-semibold text-forest">
          Day-of run sheet
        </h2>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Run sheet for {formatDate(plan.date)}, event starts at {plan.startTime}
          </caption>
          <thead className="bg-sage text-left">
            <tr>
              <th scope="col" className="p-3 font-medium">
                Time
              </th>
              <th scope="col" className="p-3 font-medium">
                What
              </th>
              <th scope="col" className="p-3 font-medium">
                Who
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.dayOf.map((slot) => (
              <tr key={slot.id} className="border-t border-cream">
                <td className="figures p-3 whitespace-nowrap">
                  {clockLabel(plan.startTime, slot.startMinute)}–
                  {clockLabel(plan.startTime, slot.startMinute + slot.durationMinutes)}
                </td>
                <th scope="row" className="p-3 text-left font-normal">
                  {slot.title}
                </th>
                <td className="p-3">{slot.ownerRole}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
