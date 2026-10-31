import type { Page } from "@playwright/test";

/**
 * Scrolls through the page so every scroll reveal runs, then waits for entrance animations and
 * transitions to finish, so axe measures colours in their final, settled state.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight * 0.7) {
      window.scrollTo(0, y);
      await frame();
    }
    window.scrollTo(0, 0);
    await frame();
  });
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.effect?.getComputedTiming().iterations === Infinity || a.playState !== "running"),
  );
}
