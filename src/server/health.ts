import "server-only";
import { ConfigError, readConfig, type AiProvider } from "@/server/http/env";

type HealthPayload =
  | { ok: true; buildVersion: string; aiEnabled: boolean; provider: AiProvider | "off" }
  | { ok: false; error: "MISCONFIGURED" };

/**
 * Computes the `/api/health` answer. Readiness only: no model name, project, origin or key is
 * ever part of the payload.
 */
export function getHealth(env: Readonly<Record<string, string | undefined>>): {
  httpStatus: 200 | 503;
  payload: HealthPayload;
} {
  let config;
  try {
    config = readConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return { httpStatus: 503, payload: { ok: false, error: "MISCONFIGURED" } };
    throw error;
  }
  return {
    httpStatus: 200,
    payload: {
      ok: true,
      buildVersion: config.buildVersion ?? "dev",
      aiEnabled: config.aiEnabled,
      provider: config.aiEnabled ? config.aiProvider : "off",
    },
  };
}
