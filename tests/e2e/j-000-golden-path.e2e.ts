/**
 * J-000, the Golden Path, as far as the product goes today: the `/` entry checkpoint.
 *
 * The journey walks what a person meets first — the landmark, its heading and tagline, a document
 * title, and the Datum ground in both themes — and judges it the way the law does: axe reports
 * zero serious/critical violations (Q-11, never widened to any impact), and the dark capture of the
 * page differs from the light one because token values flip under `[data-theme]` and nothing else
 * (R-UI-001). The remaining checkpoints of J-000 arrive with the screens that own them.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";

/** axe runs from the copy already in the checkout; the journey adds no package (Q-11). */
const AXE_SOURCE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

/** One axe violation, only as deep as Q-11 reads it. */
interface Violation {
  id: string;
  impact: string | null;
}

/** The impacts the law counts. Anything below them is not a gate — and nor is "any". */
const BLOCKING_IMPACTS = ["serious", "critical"];

/** Run axe over the whole document and answer only the violations the law counts. */
async function blockingViolations(page: Page): Promise<Violation[]> {
  await page.evaluate(AXE_SOURCE);
  const violations = await page.evaluate(async () => {
    const runner = (window as unknown as { axe: { run: (context: unknown) => Promise<{ violations: Violation[] }> } }).axe;
    const results = await runner.run(document);
    return results.violations.map((violation) => ({ id: violation.id, impact: violation.impact }));
  });
  return violations.filter((violation) => BLOCKING_IMPACTS.includes(String(violation.impact)));
}

/**
 * Walk the entry checkpoint under one OS colour preference and answer with its full-page capture.
 * `colorScheme` is Playwright's emulation lever, so the machine's own theme is never consulted.
 */
async function rootEntry(browser: Browser, baseURL: string, colorScheme: "light" | "dark", checkpoint: string, testInfo: TestInfo): Promise<Buffer> {
  const context = await browser.newContext({ baseURL, colorScheme });
  try {
    const page = await context.newPage();
    await page.goto("/");

    expect(await page.title(), "the document title comes from the root layout's metadata").not.toBe("");

    const main = page.getByTestId("root-home-main");
    await expect(main).toBeVisible();
    await expect(page.getByTestId("root-home-heading")).toBeVisible();
    await expect(page.getByTestId("root-home-tagline")).toBeVisible();

    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme, `the document resolves the ${colorScheme} theme before first paint (R-UI-001)`).toBe(colorScheme);

    const violations = await blockingViolations(page);
    expect(violations, `axe found serious/critical violations at / (${checkpoint}): ${JSON.stringify(violations)}`).toStrictEqual([]);

    const capture = await page.screenshot({ fullPage: true });
    await testInfo.attach(checkpoint, { body: capture, contentType: "image/png" });
    return capture;
  } finally {
    await context.close();
  }
}

test.describe("J-000 Golden Path", () => {
  test("J-000 root-entry: / renders the product's landmark, clean and themed both ways", async ({ browser, baseURL }, testInfo) => {
    const origin = String(baseURL);
    const light = await rootEntry(browser, origin, "light", "root-entry", testInfo);
    const dark = await rootEntry(browser, origin, "dark", "root-entry-dark", testInfo);

    expect(light.equals(dark), "the dark capture must not be byte-identical to the light one — the ground flips with the token values").toBe(false);
  });
});
