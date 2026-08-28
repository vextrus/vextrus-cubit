/**
 * J-004, the design gallery: `/design` walked in both themes, judged by axe, and captured.
 *
 * The two checkpoints — j-004-gallery-light and j-004-gallery-dark — stand on the same document
 * under the two OS colour preferences. The dark pass is driven by `prefers-color-scheme` emulation
 * and a reload, because the theme is resolved before first paint by the root document's inline
 * script; what the page actually resolved is then read off `html[data-theme]` rather than assumed
 * from what was emulated (R-UI-001).
 *
 * axe gates at serious and critical, and at nothing else: widening it to any impact would be a law
 * rewritten without a signature, and narrowing it would be no gate at all (Q-11). The shell region
 * — the deterministic chrome, not the whole gallery — is what the visual baselines compare, so a
 * sample's own motion or virtualisation can never redden Q-06.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { SDesignPage, S_DESIGN_ROUTE } from "../pages/s-design.page";

/** axe runs from the copy already in the checkout; the journey adds no package (Q-11). */
const AXE_SOURCE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

/** The impacts the law counts. Anything below them is not a gate — and nor is "any". */
const BLOCKING_IMPACTS = ["serious", "critical"];

/** One axe violation, only as deep as Q-11 reads it. */
interface Violation {
  id: string;
  impact: string | null;
  help: string;
}

/**
 * Walk one checkpoint: the page under one colour preference, populated, clean, and captured.
 * `theme` is both what the emulation asked for and what `html[data-theme]` must answer.
 */
async function galleryCheckpoint(page: Page, theme: "light" | "dark", checkpoint: string, testInfo: TestInfo): Promise<void> {
  const design = new SDesignPage(page);

  expect(await design.theme(), `${checkpoint}: the document resolved the ${theme} theme (R-UI-001)`).toBe(theme);
  await design.assertPopulated(checkpoint);

  await page.evaluate(AXE_SOURCE);
  const runViolations = await page.evaluate(async () => {
    const runner = (window as unknown as { axe: { run: (context: Document) => Promise<{ violations: Violation[] }> } }).axe;
    const results = await runner.run(document);
    return results.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help }));
  });
  const violations = runViolations.filter((entry) => BLOCKING_IMPACTS.includes(String(entry.impact)));
  expect(violations, `${checkpoint}: axe reports no serious or critical violation — ${JSON.stringify(violations)}`).toStrictEqual([]);

  await testInfo.attach(checkpoint, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

  // Q-06: the baseline is of the shell region itself, animations disabled, routed under
  // tests/e2e/baselines/ by the config's snapshotPathTemplate.
  const shell = design.shell;
  await expect(shell).toHaveScreenshot(`design/gallery-shell-${theme}.png`, { animations: "disabled" });
}

test.describe("J-004 Design gallery", () => {
  test("J-004 gallery: /design renders every entry in both themes, clean", async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(S_DESIGN_ROUTE);
    await galleryCheckpoint(page, "light", "j-004-gallery-light", testInfo);

    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await galleryCheckpoint(page, "dark", "j-004-gallery-dark", testInfo);
  });
});
