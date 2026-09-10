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

  // The runner arrives over CDP, never as a `<script>` element: `addScriptTag` appends an inline
  // script and the shipped policy's script-src admits none (Q-12), while `evaluate` is not governed
  // by CSP — so the page axe judges is the page under the real policy.
  await page.evaluate(axe.source);
  const violations = (await page.evaluate(async () => {
    const runner = (globalThis as unknown as { axe: { run: (context: Document) => Promise<{ violations: AxeViolation[] }> } }).axe;
    const results = await runner.run(document);
    return results.violations;
  })) as AxeViolation[];

  // The axe result rides beside the screenshot as its own attachment (Vextrus Builder v21 L9): the
  // evidence pack renders it next to the frame; it was asserted here and kept nowhere before.
  await testInfo.attach(`${name}.axe`, { body: JSON.stringify({ checkpoint: name, violations }, null, 1), contentType: "application/json" });
  const blocking = violations.filter((violation) => BLOCKING.has(violation.impact ?? ""));
  expect(
    blocking.map((violation) => `${violation.impact} ${violation.id}: ${violation.help} at ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`),
    `checkpoint ${name}: axe reports no serious or critical violation`,
  ).toEqual([]);
}
