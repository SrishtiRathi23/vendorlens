import { toIcs } from "@/domain/calendar";
import type { EventPlan } from "@/domain/schemas";

/** Saves text as a file in the browser; nothing is uploaded anywhere. */
export function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

export function fileSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "event"
  );
}

/** The whole plan (event day plus open tasks) as an `.ics` file for any calendar app. */
export function downloadCalendar(plan: EventPlan): void {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  download(`${fileSlug(plan.title)}.ics`, toIcs(plan, stamp), "text/calendar");
}
