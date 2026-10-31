import { describe, expect, it } from "vitest";
import { googleCalendarLink, toIcs } from "@/domain/calendar";
import { addDays, clockLabel, daysBetween, dueFromLead, formatDate, isIsoDate, istDate } from "@/domain/dates";
import { sequentialIds } from "@/domain/ids";
import { mapsSearchLink } from "@/domain/links";
import { buildSampleEvent } from "@/domain/samples";
import { TODAY } from "../helpers/factories";

describe("IST calendar dates", () => {
  it("handles month and year boundaries and IST midnight", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(daysBetween("2026-11-01", "2027-01-01")).toBe(61);
    expect(istDate(new Date("2026-10-31T19:00:00Z"))).toBe("2026-11-01"); // 00:30 IST
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(dueFromLead("2027-01-10", 5, TODAY)).toEqual({ due: "2027-01-05", doNow: false });
    expect(formatDate("2026-12-14")).toBe("Mon, 14 Dec 2026");
    expect(clockLabel("23:30", 90)).toBe("01:00");
    expect(clockLabel("06:00", -420)).toBe("23:00");
  });
});

describe("calendar exports", () => {
  const event = buildSampleEvent("community", TODAY, sequentialIds("c"));

  it("Q20 · produces a valid iCalendar file: CRLF, folded lines, escaped text, all-day dates", () => {
    const ics = toIcs(
      { ...event, title: "Diwali, mela; with a very long title that must be folded across more than one line of text" },
      "20261101T000000Z",
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("SUMMARY:Diwali\\, mela\\; with");
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(event.tasks.length + 1);
    expect(ics).toMatch(/DTSTART;VALUE=DATE:\d{8}\r\nDTEND;VALUE=DATE:\d{8}/);
  });

  it("builds Google Calendar and Maps links without any account access", () => {
    const link = new URL(googleCalendarLink("Pay caterer & decorator", "2026-12-14", "50% advance"));
    expect(link.hostname).toBe("calendar.google.com");
    expect(link.searchParams.get("text")).toBe("Pay caterer & decorator");
    expect(link.searchParams.get("dates")).toBe("20261214/20261215");
    expect(new URL(mapsSearchLink("Wedding caterer", "Jaipur")).searchParams.get("query")).toBe(
      "Wedding caterer near Jaipur",
    );
  });
});
