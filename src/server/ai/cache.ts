import "server-only";
import { createHash } from "node:crypto";

/** Stable key for a request: the same task, model and input always hash the same. */
export function cacheKey(...parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/**
 * Small in-memory LRU with a time-to-live, plus in-flight de-duplication: identical requests that
 * arrive while the first is still running share one model call instead of paying for two.
 */
export class ResponseCache<T> {
  private readonly entries = new Map<string, { value: T; expires: number }>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly maxEntries = 100,
    private readonly ttlMs = 30 * 60_000,
  ) {}

  /** Returns the cached value (and `cached: true`) or runs `produce` exactly once per key. */
  async getOrCreate(
    key: string,
    produce: () => Promise<T>,
    now: () => number = Date.now,
  ): Promise<{ value: T; cached: boolean }> {
    const hit = this.entries.get(key);
    if (hit && hit.expires > now()) {
      this.entries.delete(key);
      this.entries.set(key, hit); // refresh recency
      return { value: hit.value, cached: true };
    }
    const pending = this.inFlight.get(key);
    if (pending) return { value: await pending, cached: true };

    const task = produce();
    this.inFlight.set(key, task);
    try {
      const value = await task;
      this.entries.set(key, { value, expires: now() + this.ttlMs });
      if (this.entries.size > this.maxEntries) {
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) this.entries.delete(oldest);
      }
      return { value, cached: false };
    } finally {
      this.inFlight.delete(key);
    }
  }
}
