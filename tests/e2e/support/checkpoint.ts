// V-E2E's named checkpoints: at each one the journey attaches a screenshot and runs axe over the
// page it is standing on. Serious and critical violations fail the journey — an accessibility
// failure at a checkpoint is a failure of the screen, not a note for later (R-UI-012).
import axe from "axe-core";
import { expect, type Page, type TestInfo } from "@playwright/test";

/** What a checkpoint refuses to pass with. Anything milder is reported by the design lane. */
const BLOCKING = new Set(["serious", "critical"]);

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[] }[];
}

/** Attach the screenshot this checkpoint is named for, then judge the page with axe. */
export async function checkpoint(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

  await page.addScriptTag({ content: axe.source });
  const violations = (await page.evaluate(async () => {
    const runner = (globalThis as unknown as { axe: { run: (context: Document) => Promise<{ violations: AxeViolation[] }> } }).axe;
    const results = await runner.run(document);
    return results.violations;
  })) as AxeViolation[];

  const blocking = violations.filter((violation) => BLOCKING.has(violation.impact ?? ""));
  expect(
    blocking.map((violation) => `${violation.impact} ${violation.id}: ${violation.help} at ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`),
    `checkpoint ${name}: axe reports no serious or critical violation`,
  ).toEqual([]);
}
