import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "@/server/http/env";

const vertexReady = { AI_ENABLED: "true", GEMINI_MODEL: "flash-lite", GOOGLE_CLOUD_PROJECT: "vendorlens-demo" };

function fieldsRejectedFor(env: Record<string, string>): string[] {
  try {
    readConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error.fields;
    throw error;
  }
  return [];
}

describe("readConfig", () => {
  it("starts safe: AI off, keyless Vertex selected, global location, no extra origins", () => {
    expect(readConfig({})).toMatchObject({
      mode: "development",
      aiEnabled: false,
      aiProvider: "vertex",
      gcpLocation: "global",
      extraOrigins: [],
    });
  });

  it("accepts a complete Vertex setup without any API key", () => {
    const config = readConfig({ ...vertexReady, NODE_ENV: "production", K_REVISION: "vendorlens-00003-qrs" });
    expect(config).toMatchObject({ aiEnabled: true, aiProvider: "vertex", buildVersion: "vendorlens-00003-qrs" });
    expect(config.geminiApiKey).toBeUndefined();
  });

  it("reads an optional fallback model", () => {
    expect(readConfig({ ...vertexReady, GEMINI_FALLBACK_MODEL: "flash-lite-older" }).geminiFallbackModel).toBe(
      "flash-lite-older",
    );
  });

  it.each([
    ["Vertex without model or project", { AI_ENABLED: "true" }, ["GEMINI_MODEL", "GOOGLE_CLOUD_PROJECT"]],
    [
      "Developer API without a key",
      { AI_ENABLED: "true", AI_PROVIDER: "developer", GEMINI_MODEL: "m" },
      ["GEMINI_API_KEY"],
    ],
    ["fixture provider in production", { NODE_ENV: "production", AI_PROVIDER: "fixture" }, ["AI_PROVIDER"]],
    ["a non-boolean AI flag", { AI_ENABLED: "on" }, ["AI_ENABLED"]],
    ["an origin with a path", { ALLOWED_ORIGINS: "https://desk.example/app" }, ["ALLOWED_ORIGINS"]],
    ["a non-web origin", { ALLOWED_ORIGINS: "ftp://desk.example" }, ["ALLOWED_ORIGINS"]],
    ["text that is not a URL", { ALLOWED_ORIGINS: "desk" }, ["ALLOWED_ORIGINS"]],
  ])("rejects %s", (_label, env, fields) => {
    expect(fieldsRejectedFor(env)).toEqual(fields);
  });

  it("lets tests use the fixture provider with AI on and no model", () => {
    expect(readConfig({ NODE_ENV: "test", AI_ENABLED: "true", AI_PROVIDER: "fixture" }).aiProvider).toBe("fixture");
  });

  it("splits and trims the extra origin list", () => {
    expect(readConfig({ ALLOWED_ORIGINS: "https://a.example, http://127.0.0.1:3210 ," }).extraOrigins).toEqual([
      "https://a.example",
      "http://127.0.0.1:3210",
    ]);
  });

  it("keeps secret values out of the error text", () => {
    const key = "AQ.do-not-leak-this-value";
    expect(() => readConfig({ AI_ENABLED: "sometimes", GEMINI_API_KEY: key })).toThrow(ConfigError);
    expect(() => readConfig({ AI_ENABLED: "sometimes", GEMINI_API_KEY: key })).not.toThrow(key);
  });
});
