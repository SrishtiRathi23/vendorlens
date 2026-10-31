/** Id generator injected into builders so tests can make ids deterministic. */
export type IdFactory = () => string;

export const randomId: IdFactory = () => crypto.randomUUID();

/** Sequential ids for tests and fixtures: `prefix-1`, `prefix-2`, … */
export function sequentialIds(prefix = "id"): IdFactory {
  let next = 0;
  return () => `${prefix}-${String(++next)}`;
}
