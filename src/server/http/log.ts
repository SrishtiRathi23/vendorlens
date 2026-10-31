import "server-only";

type LogValue = string | number | boolean | null;

/**
 * One JSON line per event, which Cloud Logging indexes automatically. Callers pass codes, counts
 * and timings only: never quote text, briefs, prompts or model output.
 */
export function logEvent(event: string, fields: Record<string, LogValue> = {}): void {
  console.info(JSON.stringify({ severity: "INFO", event, ...fields }));
}
