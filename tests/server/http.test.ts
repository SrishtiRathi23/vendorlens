import { describe, expect, it, vi } from "vitest";
import { ResponseCache, cacheKey } from "@/server/ai/cache";
import { redactContactDetails, scrubOutput } from "@/server/ai/text-safety";
import { ApiError } from "@/server/http/errors";
import { assertSameOrigin, clientKey, readJsonBody } from "@/server/http/guards";
import { RateLimiter } from "@/server/http/rate-limit";

const post = (headers: Record<string, string>, body = "{}") =>
  new Request("https://vendorlens.test/api/ai/draft", { method: "POST", headers, body });

describe("same-origin guard", () => {
  it("accepts the app's own origin, including through Firebase Hosting", () => {
    expect(() =>
      assertSameOrigin(post({ origin: "https://vendorlens.test", host: "vendorlens.test" }), []),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(
        post({ origin: "https://site.web.app", host: "run.app.internal", "x-forwarded-host": "site.web.app" }),
        [],
      ),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(post({ origin: "https://site.web.app", host: "other" }), ["https://site.web.app"]),
    ).not.toThrow();
  });

  it("refuses other sites and requests with no Origin at all", () => {
    expect(() => assertSameOrigin(post({ origin: "https://evil.example", host: "vendorlens.test" }), [])).toThrow(
      ApiError,
    );
    expect(() => assertSameOrigin(post({ host: "vendorlens.test" }), [])).toThrow(ApiError);
    expect(() => assertSameOrigin(post({ origin: "null", host: "vendorlens.test" }), [])).toThrow(ApiError);
  });
});

describe("bounded JSON body", () => {
  it("rejects oversized declared or actual bodies, and invalid JSON", async () => {
    await expect(readJsonBody(post({ "content-length": "999999" }), 100)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    await expect(readJsonBody(post({}, JSON.stringify({ text: "x".repeat(200) })), 100)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    await expect(readJsonBody(post({}, "{nope"), 100)).rejects.toMatchObject({ code: "BAD_INPUT" });
    await expect(readJsonBody(post({}, '{"a":1}'), 100)).resolves.toEqual({ a: 1 });
  });

  it("identifies the caller by the first forwarded address", () => {
    expect(clientKey(post({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientKey(post({}))).toBe("unknown");
  });
});

describe("rate limiting", () => {
  it("limits each caller per minute and per day, and everyone together per day", () => {
    const limiter = new RateLimiter({ perClientPerMinute: 2, perClientPerDay: 3, globalPerDay: 4 });
    expect([limiter.take("a", 0), limiter.take("a", 1)]).toEqual([null, null]);
    expect(limiter.take("a", 2)).toBe(60);
    expect(limiter.take("a", 61_000)).toBeNull();
    expect(limiter.take("a", 122_000)).toBeGreaterThan(80_000); // day limit for "a"
    expect(limiter.take("b", 122_000)).toBeNull();
    expect(limiter.take("c", 122_000)).toBeGreaterThan(0); // global limit reached
  });
});

describe("response cache", () => {
  it("Q19 · identical concurrent requests share one model call; later ones are served from cache", async () => {
    const cache = new ResponseCache<number>(2, 1_000);
    const produce = vi.fn(async () => {
      await Promise.resolve();
      return 42;
    });
    const key = cacheKey("draft", { guests: 150 });
    const [first, second] = await Promise.all([cache.getOrCreate(key, produce), cache.getOrCreate(key, produce)]);
    expect(produce).toHaveBeenCalledTimes(1);
    expect([first.cached, second.cached]).toEqual([false, true]);
    expect((await cache.getOrCreate(key, produce)).cached).toBe(true);
  });

  it("expires entries and evicts the least recently used", async () => {
    let now = 0;
    const cache = new ResponseCache<string>(2, 100);
    await cache.getOrCreate(
      "a",
      () => Promise.resolve("A"),
      () => now,
    );
    await cache.getOrCreate(
      "b",
      () => Promise.resolve("B"),
      () => now,
    );
    await cache.getOrCreate(
      "c",
      () => Promise.resolve("C"),
      () => now,
    );
    expect(
      (
        await cache.getOrCreate(
          "a",
          () => Promise.resolve("A2"),
          () => now,
        )
      ).value,
    ).toBe("A2"); // evicted
    now = 500;
    expect(
      (
        await cache.getOrCreate(
          "c",
          () => Promise.resolve("C2"),
          () => now,
        )
      ).value,
    ).toBe("C2"); // expired
    expect(cacheKey(1, "x")).toBe(cacheKey(1, "x"));
  });
});

describe("contact redaction and output scrubbing", () => {
  it("Q18 · removes emails, links and phone numbers but keeps prices", () => {
    const text =
      "Mail ravi@caterer.in or call +91 98765 43210 / 080-2345 6789, see www.caterer.in. Price ₹1,50,000 for 150 plates.";
    const clean = redactContactDetails(text);
    for (const leak of ["ravi@", "98765", "2345 6789", "www."]) expect(clean).not.toContain(leak);
    expect(clean).toContain("₹1,50,000 for 150 plates");
  });

  it("scrubs every string in nested model output", () => {
    expect(scrubOutput({ a: ["visit https://x.example now"], b: { c: "ok" }, n: 3, z: null })).toEqual({
      a: ["visit [redacted] now"],
      b: { c: "ok" },
      n: 3,
      z: null,
    });
  });
});
