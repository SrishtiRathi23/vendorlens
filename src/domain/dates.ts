/**
 * Calendar dates are `YYYY-MM-DD` strings in India Standard Time. Date-only arithmetic is done in
 * UTC on those strings, so daylight-saving rules elsewhere can never shift a day.
 */
export type IsoDate = string;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isIsoDate(value: string): value is IsoDate {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** The IST calendar date of an instant. */
export function istDate(instant: Date): IsoDate {
  return instant.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const shifted = new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * Turns "do this N days before the event" into a due date. When that date has already passed the
 * task is due today and flagged `doNow`, instead of silently showing a date in the past.
 */
export function dueFromLead(eventDate: IsoDate, leadDays: number, today: IsoDate): { due: IsoDate; doNow: boolean } {
  const ideal = addDays(eventDate, -leadDays);
  return ideal < today ? { due: today, doNow: true } : { due: ideal, doNow: false };
}

const longFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "Mon, 14 Dec 2026", assembled from parts so ICU punctuation differences can't leak in. */
export function formatDate(date: IsoDate): string {
  const parts = Object.fromEntries(
    longFormat.formatToParts(new Date(`${date}T00:00:00Z`)).map((p) => [p.type, p.value]),
  );
  return `${parts.weekday ?? ""}, ${parts.day ?? ""} ${parts.month ?? ""} ${parts.year ?? ""}`;
}

/** "18:30" plus minutes, wrapped to a 24-hour clock label. */
export function clockLabel(startTime: string, offsetMinutes: number): string {
  const [hours = 0, minutes = 0] = startTime.split(":").map(Number);
  const total = (((hours * 60 + minutes + offsetMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
