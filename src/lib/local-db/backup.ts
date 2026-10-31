import { type EventPlan, EventSchema } from "@/domain/schemas";

const MAX_BACKUP_BYTES = 2_000_000;

/** A portable, versioned JSON backup of one plan. It contains data only, never code. */
export function exportPlan(plan: EventPlan, exportedAt: string): string {
  return JSON.stringify({ app: "vendorlens", schemaVersion: 2, exportedAt, plan }, null, 2);
}

export type ImportResult = { ok: true; plan: EventPlan } | { ok: false; reason: string };

/**
 * Reads a backup file's text. Anything oversized, from another app, from an unknown version or
 * not matching the schema is rejected with a reason, and the caller keeps the current plan.
 */
export function importPlan(text: string): ImportResult {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    return { ok: false, reason: "That file is larger than a VendorLens backup can be (2 MB)." };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "That file isn't valid JSON." };
  }
  if (typeof data !== "object" || data === null || (data as { app?: unknown }).app !== "vendorlens") {
    return { ok: false, reason: "That file isn't a VendorLens backup." };
  }
  if ((data as { schemaVersion?: unknown }).schemaVersion !== 2)
    return { ok: false, reason: "That backup comes from an unsupported version of VendorLens." };
  const parsed = EventSchema.safeParse((data as { plan?: unknown }).plan);
  return parsed.success
    ? { ok: true, plan: parsed.data }
    : { ok: false, reason: "The backup is damaged: some of its fields are missing or invalid." };
}
