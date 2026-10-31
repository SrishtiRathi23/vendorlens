import { describe, expect, it } from "vitest";
import { getHealth } from "@/server/health";

describe("getHealth", () => {
  it("is ready on a bare environment and labels the build as dev", () => {
    expect(getHealth({})).toEqual({
      httpStatus: 200,
      payload: { ok: true, buildVersion: "dev", aiEnabled: false, provider: "off" },
    });
  });

  it("shows the deployed revision and which provider answers AI calls", () => {
    const { payload } = getHealth({
      AI_ENABLED: "true",
      GEMINI_MODEL: "flash-lite",
      GOOGLE_CLOUD_PROJECT: "vendorlens-demo",
      K_REVISION: "vendorlens-00007-abc",
    });
    expect(payload).toEqual({ ok: true, buildVersion: "vendorlens-00007-abc", aiEnabled: true, provider: "vertex" });
  });

  it("answers 503 with a fixed code and no details when configuration is broken", () => {
    const result = getHealth({ AI_ENABLED: "true", GEMINI_API_KEY: "AQ.secret" });
    expect(result).toEqual({ httpStatus: 503, payload: { ok: false, error: "MISCONFIGURED" } });
    expect(JSON.stringify(result)).not.toMatch(/secret|GEMINI|GOOGLE/);
  });
});
