import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("deploy skeleton", () => {
  test("health probe is uncached and reveals no configuration", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    expect(res.headers()["cache-control"]).toMatch(/no-store/);
    expect(await res.json()).toEqual({ ok: true, buildVersion: "dev", aiEnabled: false, provider: "off" });
  });

  test("landing page passes axe and carries the baseline security headers", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.headers()).toMatchObject({
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
    });
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("cheapest quote");

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const severe = violations.filter(({ impact }) => impact === "critical" || impact === "serious");
    expect(severe.map(({ id }) => id)).toEqual([]);
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`no page-wide horizontal scroll at ${String(width)}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(width);
    });
  }

  test("keyboard users can jump straight to the content", async ({ page, browserName }, info) => {
    test.skip(info.project.name === "chromium-phone", "phones have no Tab key");
    expect(browserName).toBe("chromium");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#content$/);
  });
});
