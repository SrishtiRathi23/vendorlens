import "server-only";
import { z } from "zod";

export type AiProvider = "vertex" | "developer" | "fixture";

/** Typed, validated runtime configuration for the server. */
export interface AppConfig {
  mode: "development" | "production" | "test";
  aiEnabled: boolean;
  aiProvider: AiProvider;
  geminiModel?: string;
  gcpProject?: string;
  gcpLocation: string;
  geminiApiKey?: string;
  extraOrigins: string[];
  buildVersion?: string;
}

/** Raised for bad configuration. Lists the offending variable names; values are never included. */
export class ConfigError extends Error {
  readonly fields: string[];

  constructor(fields: string[]) {
    super(`Server configuration is invalid (${fields.join(", ")})`);
    this.name = "ConfigError";
    this.fields = fields;
  }
}

const text = z.string().trim().min(1).max(200).optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  AI_ENABLED: z.stringbool({ truthy: ["true"], falsy: ["false"] }).default(false),
  AI_PROVIDER: z.enum(["vertex", "developer", "fixture"]).default("vertex"),
  GEMINI_MODEL: text,
  GOOGLE_CLOUD_PROJECT: text,
  GOOGLE_CLOUD_LOCATION: z.string().trim().min(1).max(60).default("global"),
  GEMINI_API_KEY: text,
  ALLOWED_ORIGINS: z.string().max(2000).default(""),
  K_REVISION: text,
});

type RawConfig = z.infer<typeof schema>;

/** Variables that must be present when AI is switched on, per provider. */
const REQUIRED_WHEN_AI_ON: Record<AiProvider, (keyof RawConfig)[]> = {
  vertex: ["GEMINI_MODEL", "GOOGLE_CLOUD_PROJECT"],
  developer: ["GEMINI_MODEL", "GEMINI_API_KEY"],
  fixture: [],
};

const toOrigins = (list: string): string[] =>
  list
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const isWebOrigin = (candidate: string): boolean =>
  URL.canParse(candidate) &&
  ["http:", "https:"].includes(new URL(candidate).protocol) &&
  new URL(candidate).origin === candidate;

function crossFieldProblems(raw: RawConfig): string[] {
  const problems: string[] = [];
  if (raw.AI_ENABLED) {
    problems.push(...REQUIRED_WHEN_AI_ON[raw.AI_PROVIDER].filter((key) => raw[key] === undefined));
  }
  if (raw.AI_PROVIDER === "fixture" && raw.NODE_ENV === "production") problems.push("AI_PROVIDER");
  if (!toOrigins(raw.ALLOWED_ORIGINS).every(isWebOrigin)) problems.push("ALLOWED_ORIGINS");
  return problems;
}

/** Reads and validates configuration from an environment-like record (usually `process.env`). */
export function readConfig(source: Readonly<Record<string, string | undefined>>): AppConfig {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError([...new Set(parsed.error.issues.map((issue) => String(issue.path.at(0))))]);
  }
  const raw = parsed.data;
  const problems = crossFieldProblems(raw);
  if (problems.length > 0) throw new ConfigError(problems);

  return {
    mode: raw.NODE_ENV,
    aiEnabled: raw.AI_ENABLED,
    aiProvider: raw.AI_PROVIDER,
    geminiModel: raw.GEMINI_MODEL,
    gcpProject: raw.GOOGLE_CLOUD_PROJECT,
    gcpLocation: raw.GOOGLE_CLOUD_LOCATION,
    geminiApiKey: raw.GEMINI_API_KEY,
    extraOrigins: toOrigins(raw.ALLOWED_ORIGINS),
    buildVersion: raw.K_REVISION,
  };
}
