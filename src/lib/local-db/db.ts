import { openDB } from "idb";
import { type EventPlan, EventSchema } from "@/domain/schemas";

const DB_NAME = "vendorlens-v2";
const STORE = "workspace";
const ACTIVE = "active";

function database() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE);
    },
  });
}

/**
 * The plan currently open in this browser, or `null` if there is none or the stored copy no longer
 * matches the schema (a damaged record is ignored rather than crashing the app).
 */
export async function loadActivePlan(): Promise<EventPlan | null> {
  const stored: unknown = await (await database()).get(STORE, ACTIVE);
  const parsed = EventSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

export async function saveActivePlan(plan: EventPlan): Promise<void> {
  await (await database()).put(STORE, plan, ACTIVE);
}

/** Deletes everything VendorLens stored in this browser. */
export async function clearStoredPlans(): Promise<void> {
  await (await database()).clear(STORE);
}
