import { addDays, type IsoDate } from "@/domain/dates";
import type { EventPlan } from "@/domain/schemas";

const compact = (date: IsoDate) => date.replace(/-/g, "");

/** RFC 5545 text escaping. */
function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding: lines longer than 75 octets continue on the next line after a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (new TextEncoder().encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** An `.ics` calendar with the event day and every open task as all-day entries. */
export function toIcs(event: EventPlan, stampUtc: string): string {
  const entries = [
    { uid: `${event.id}-event`, date: event.date, summary: event.title },
    ...event.tasks.filter((t) => !t.done).map((t) => ({ uid: t.id, date: t.due, summary: t.title })),
  ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VendorLens//Event plan//EN",
    "CALSCALE:GREGORIAN",
    ...entries.flatMap((entry) => [
      "BEGIN:VEVENT",
      `UID:${entry.uid}@vendorlens`,
      `DTSTAMP:${stampUtc}`,
      `DTSTART;VALUE=DATE:${compact(entry.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(entry.date, 1))}`,
      `SUMMARY:${escapeText(entry.summary)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** A Google Calendar "add event" link for an all-day item. No account access is involved. */
export function googleCalendarLink(title: string, date: IsoDate, details = ""): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${compact(date)}/${compact(addDays(date, 1))}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
