import "server-only";

export interface RateLimits {
  perClientPerMinute: number;
  perClientPerDay: number;
  globalPerDay: number;
}

const DEFAULT_LIMITS: RateLimits = { perClientPerMinute: 10, perClientPerDay: 60, globalPerDay: 600 };

const MINUTE = 60_000;
const DAY = 86_400_000;

/**
 * Fixed-window counters held in memory. Cloud Run runs this service with at most one instance, so
 * the limits are real for this deployment; with more instances they would need a shared store.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly limits: RateLimits = DEFAULT_LIMITS) {}

  /** Counts one request. Returns `null` when allowed, otherwise the seconds to wait. */
  take(client: string, now: number = Date.now()): number | null {
    const checks: [string, number, number][] = [
      [`m:${client}`, MINUTE, this.limits.perClientPerMinute],
      [`d:${client}`, DAY, this.limits.perClientPerDay],
      ["d:*", DAY, this.limits.globalPerDay],
    ];
    for (const [key, span, limit] of checks) {
      const window = this.current(key, span, now);
      if (window.count >= limit) return Math.max(1, Math.ceil((window.start + span - now) / 1000));
    }
    for (const [key, span] of checks) this.current(key, span, now).count += 1;
    if (this.windows.size > 10_000) this.prune(now);
    return null;
  }

  private current(key: string, span: number, now: number) {
    const existing = this.windows.get(key);
    if (existing && now - existing.start < span) return existing;
    const fresh = { start: now, count: 0 };
    this.windows.set(key, fresh);
    return fresh;
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows) if (now - window.start >= DAY) this.windows.delete(key);
  }
}
