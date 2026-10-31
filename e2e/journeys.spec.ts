import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import type { DraftResponse, ExtractResponse } from "@/domain/contracts";
import { emptyQuote } from "@/domain/extraction";
import { sequentialIds } from "@/domain/ids";
import { TEMPLATE_DRAFTS } from "@/domain/templates";

/** Every AI route is answered by the test, so E2E never reaches the live model. */
async function mockAi(page: Page, answers: Partial<Record<"draft" | "adjust" | "extract", unknown>>) {
  const calls: string[] = [];
  await page.route("**/api/ai/*", async (route) => {
    const task = route.request().url().split("/").pop() as "draft" | "adjust" | "extract";
    calls.push(task);
    const data = answers[task];
    await route.fulfill(
      data === undefined
        ? {
            status: 503,
            json: {
              ok: false,
              error: { code: "MODEL_UNAVAILABLE", message: "The AI service is busy or unavailable." },
            },
          }
        : { json: { ok: true, data, meta: { model: "test", cached: false, repaired: false } } },
    );
  });
  return calls;
}

async function openSample(page: Page, kind: "wedding" | "birthday" | "community") {
  await page.goto("/");
  await page.getByRole("button", { name: `Sample ${kind === "community" ? "community event" : kind}` }).click();
  await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
}

test("Q22 · hero: compare two catering quotes honestly, choose one, and see budget and payments update", async ({
  page,
}) => {
  const calls = await mockAi(page, {});
  await openSample(page, "wedding");
  await expect(page).toHaveURL(/\/workspace\/compare$/);
  await expect(page.getByRole("status").filter({ hasText: "No winner yet" })).toBeVisible();
  await expect(page.getByRole("region", { name: /Catering quotes compared/ })).toContainText("Incomplete");

  await page.getByRole("button", { name: "Choose Annapurna Feasts (sample)" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose this vendor?" });
  await expect(dialog).toContainText("known total");
  await dialog.getByRole("button", { name: "Choose and update budget" }).click();
  await expect(page.getByText("Chosen").first()).toBeVisible();

  await page.getByRole("link", { name: "Budget" }).click();
  await expect(page.getByRole("row", { name: /Catering/ })).toContainText("Chosen quote");
  await page.getByRole("link", { name: "Timeline" }).click();
  await expect(page.getByText(/Pay Annapurna Feasts \(sample\): 50% advance/).first()).toBeVisible();
  expect(calls).toEqual([]); // Q23: comparing and choosing never calls the AI
});

test("Q21 · plan a birthday from the wizard with an AI draft, and it survives a reload", async ({ page }) => {
  const draft: DraftResponse = { draft: TEMPLATE_DRAFTS.birthday, notes: ["No menu idea is marked vegan."] };
  const calls = await mockAi(page, { draft });
  await page.goto("/new");
  await page.getByLabel("Type of event").selectOption("birthday");
  await page.getByLabel("Event name").fill("Meera turns 30");
  await page.getByLabel("City or area").fill("Pune");
  await page.getByLabel("Guests").fill("40");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Total budget (₹)").fill("1,20,000");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Vegan").check();
  await page.getByRole("button", { name: "Generate my plan" }).click();

  await expect(page.getByText("AI-drafted plan")).toBeVisible();
  await expect(page.getByText("No menu idea is marked vegan.")).toBeVisible();
  expect(calls).toEqual(["draft"]);
  await page.reload();
  await expect(page.getByText("Meera turns 30")).toBeVisible();
});

test("wizard explains errors and falls back to a labelled template when AI is down", async ({ page }) => {
  await mockAi(page, {});
  await page.goto("/new");
  await page.getByRole("button", { name: "Next" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Please fix" });
  await expect(alert).toBeFocused();
  await expect(alert).toContainText("Give the event a name.");

  await page.getByLabel("Type of event").selectOption("community");
  await page.getByLabel("Event name").fill("Diwali mela");
  await page.getByLabel("City or area").fill("Bengaluru");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Total budget (₹)").fill("2,00,000");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Generate my plan" }).click();
  await expect(page.getByText("Template plan (AI was unavailable)")).toBeVisible();
});

test("paste a quote, extract it, review and confirm", async ({ page }) => {
  const quote = {
    ...emptyQuote("decor", "", sequentialIds("e")),
    vendorAlias: "Phoolwala Decor (sample)",
    sourceType: "pasted" as const,
  };
  quote.lines = [
    { id: "line-1", description: "Stage decor", basis: "flat", unitPaise: 4_500_000, quantity: null, mandatory: true },
  ];
  quote.provenance = { "lines.0": "matched", vendorAlias: "matched" };
  quote.evidence = { "lines.0": "Stage decor ₹45,000" };
  const extract: ExtractResponse = { quote };
  const calls = await mockAi(page, { extract });
  await openSample(page, "birthday");
  await page.getByRole("link", { name: "Vendors" }).click();
  await page.getByRole("button", { name: "Add a decor quote" }).click();
  await page.getByLabel("Paste the vendor's quote").fill("Phoolwala Decor (sample)\nStage decor ₹45,000. Taxes extra.");
  await page.getByRole("button", { name: "Extract details with AI" }).click();
  await expect(page.getByText("Found in quote").first()).toBeVisible();
  await expect(page.getByText("From the quote: “Stage decor ₹45,000”")).toBeVisible();
  await page.getByRole("button", { name: "Confirm quote" }).click();
  await expect(page.getByRole("list", { name: "Decor quotes" })).toContainText("Confirmed");
  expect(calls).toEqual(["extract"]);
});

test("adjust with AI shows a preview, applies on approval and can be undone", async ({ page }) => {
  const adjust = {
    interpretation: "Raise the guest count to 60.",
    operations: [
      {
        op: "set_guest_count",
        ref: null,
        category: null,
        number: 60,
        date: null,
        title: null,
        detail: null,
        priority: null,
        required: null,
        coverageTags: null,
        section: null,
      },
    ],
    cannotDo: [],
  };
  await mockAi(page, { adjust });
  await openSample(page, "birthday");
  await page.getByLabel("What should change?").fill("We now expect 60 guests");
  await page.getByRole("button", { name: "Preview change" }).click();
  const dialog = page.getByRole("dialog", { name: "Review the change" });
  await expect(dialog).toContainText("Guests: 40 → 60");
  await dialog.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.getByText("60 guests")).toBeVisible();
  await page.getByRole("button", { name: "Undo last change" }).click();
  await expect(page.getByText("40 guests")).toBeVisible();
});

test("Escape closes the preview without applying anything", async ({ page }, info) => {
  test.skip(info.project.name === "chromium-phone", "keyboard check");
  await mockAi(page, {
    adjust: { interpretation: "Nothing.", operations: [], cannotDo: ["Locked items stay as they are."] },
  });
  await openSample(page, "birthday");
  await page.getByLabel("What should change?").fill("Change the venue");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Review the change" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByLabel("What should change?")).toBeVisible();
});

for (const path of [
  "/workspace",
  "/workspace/budget",
  "/workspace/vendors",
  "/workspace/compare",
  "/workspace/timeline",
  "/workspace/ideas",
  "/new",
  "/privacy",
]) {
  test(`Q16 · ${path} has no serious accessibility violations and no sideways scroll`, async ({ page }) => {
    await mockAi(page, {});
    await openSample(page, "wedding");
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ") ?? ""}`),
    ).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
