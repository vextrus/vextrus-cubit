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

/** How long a checkpoint waits for the screen to settle before it believes a blocking violation. */
const SETTLE_MS = 6_000;

/** Attach the screenshot this checkpoint is named for, then judge the page with axe. */
export async function checkpoint(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  // The runner arrives over CDP, never as a `<script>` element: `addScriptTag` appends an inline
  // script and the shipped policy's script-src admits none (Q-12), while `evaluate` is not governed
  // by CSP — so the page axe judges is the page under the real policy.
  await page.evaluate(axe.source);
  const run = async (): Promise<AxeViolation[]> =>
    (await page.evaluate(async () => {
      const runner = (globalThis as unknown as { axe: { run: (context: Document) => Promise<{ violations: AxeViolation[] }> } }).axe;
      const results = await runner.run(document);
      return results.violations;
    })) as AxeViolation[];

  // A checkpoint judges the screen a reader stands on, which means the SETTLED screen. axe reads
  // computed colour off the DOM as it is at the instant it runs, so a page still painting — a
  // skeleton behind a dialog, a surface whose background has not landed — can hand it a contrast
  // pair that exists in no frame a reader ever sees. On 2026-09-11 that turned J-021 red on main:
  // `serious color-contrast` on all three headings of the shortcut sheet, in a run whose own
  // failure screenshot shows the page behind still drawing its skeletons, and green on the two runs
  // either side of it. So a blocking violation is re-read until it holds still: one that survives
  // SETTLE_MS is the screen's and fails the journey, one that does not was never the screen's.
  let violations = await run();
  for (const deadline = Date.now() + SETTLE_MS; violations.some((v) => BLOCKING.has(v.impact ?? "")) && Date.now() < deadline; ) {
    await page.waitForTimeout(250);
    violations = await run();
  }
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

  // The axe result rides beside the screenshot as its own attachment (Vextrus Builder v21 L9): the
  // evidence pack renders it next to the frame; it was asserted here and kept nowhere before.
  await testInfo.attach(`${name}.axe`, { body: JSON.stringify({ checkpoint: name, violations }, null, 1), contentType: "application/json" });
  const blocking = violations.filter((violation) => BLOCKING.has(violation.impact ?? ""));
  expect(
    blocking.map((violation) => `${violation.impact} ${violation.id}: ${violation.help} at ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`),
    `checkpoint ${name}: axe reports no serious or critical violation`,
  ).toEqual([]);
}
