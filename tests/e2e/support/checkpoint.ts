// V-E2E's named checkpoints: at each one the journey attaches a capture of the screen and runs axe
// over the page it is standing on. Serious and critical violations fail the journey — an
// accessibility failure at a checkpoint is a failure of the screen, not a note for later (R-UI-012).
// Moderate violations are held to a per-screen budget (tests/e2e/support/axe-budget.ts).
//
// WHY THE 6 s RE-READ LOOP IS GONE. A checkpoint judges the SETTLED screen: axe reads computed
// colour off the DOM at the instant it runs, so a page still painting can hand it a contrast pair
// that exists in no frame a reader ever sees (that is what turned J-021 red on main on 2026-09-11,
// green either side of it). The old cure was to re-read a blocking violation every 250 ms for six
// seconds and believe only what survived — a sleep loop, which is a guess: too short and the flake
// returns, too long and every green checkpoint in the wall pays the tax. `settled(page)` replaces
// it by stating what "still arriving" MEANS — fonts loaded, nothing `aria-busy`, every screen root
// past its loading state, every virtualised table's rows painted, no finite animation running — and
// polling that reading instead of the clock. axe then runs once, on a screen that has stopped
// moving, and what it reports is the screen's (AM-09 §4, B-19: a flake is a defect with a cause).
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import axe from "axe-core";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { moderateBudgetFor } from "./axe-budget";
import { settled } from "./settled";

/** What a checkpoint refuses to pass with. Anything milder is held to its budget or reported. */
const BLOCKING = new Set(["serious", "critical"]);

/**
 * The conformance the lane judges against, stated rather than inherited: axe's default tag set
 * drifts with the library, and a gate whose bar moves when a dependency is bumped is not a bar.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] as const;

/**
 * §9.3: a capture may be at most twice the viewport tall. The 5404 px card the founder caught would
 * have failed here. Taller than this is not a picture of a screen — it is a picture of a scroll.
 */
const HEIGHT_CAP_FACTOR = 2;

/**
 * Where the whole screen lives. The shell's `main` scrolls INTERNALLY (`.cx-shell-main { overflow:
 * auto }`), so `fullPage: true` captured the viewport and called it the page — §9.3's "full page is
 * a lie". The container is found in this order, and the capture is of that container expanded to
 * its own content.
 */
const CAPTURE_ROOTS = ["[data-capture-root]", '[data-testid="shell-main"]', "main", "body"] as const;

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[] }[];
}

/** What the capture measured, so a failure can say which screen was how tall. */
interface Capture {
  readonly selector: string;
  readonly contentHeight: number;
  readonly cap: number;
  readonly body: Buffer;
}

/** The one-line summary of a violation, as a failure message prints it. */
function describe(violation: AxeViolation): string {
  return `${violation.impact} ${violation.id}: ${violation.help} at ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`;
}

/**
 * The first capture root that exists on this page, with the selector that found it. The choice is
 * made IN THE PAGE, in one reading: asking Playwright four times whether a locator matched would be
 * four one-shot reads of a screen, which is the thing this lane bans.
 */
async function captureRoot(page: Page): Promise<{ selector: string; locator: Locator }> {
  const selector = await page.evaluate((candidates) => candidates.find((one) => document.querySelector(one) !== null) ?? "body", CAPTURE_ROOTS);
  return { selector, locator: page.locator(selector).first() };
}

/**
 * The whole screen, once: the scroll container is expanded to its content (capped), photographed,
 * and put back exactly as it was — the style attribute is restored verbatim, not cleared, so a
 * screen that carried inline style before the capture carries the same inline style after it.
 */
async function captureScreen(page: Page, root: { selector: string; locator: Locator }): Promise<Capture> {
  const viewport = page.viewportSize();
  const cap = (viewport?.height ?? 900) * HEIGHT_CAP_FACTOR;
  const measured = await root.locator.evaluate((element, capPx) => {
    const before = element.getAttribute("style");
    const content = Math.max(element.scrollHeight, element.clientHeight);
    element.setAttribute("style", `${before === null ? "" : `${before};`}height:${Math.min(content, capPx)}px !important;max-height:none !important;overflow:visible !important;`);
    return { before, content };
  }, cap);
  try {
    // An element screenshot captures the WHOLE element, scrolling and stitching as it needs to —
    // which is the point: what is photographed is the expanded container, not the viewport over it.
    const body = await root.locator.screenshot();
    return { selector: root.selector, contentHeight: measured.content, cap, body };
  } finally {
    await root.locator.evaluate((element, before) => {
      if (before === null) element.removeAttribute("style");
      else element.setAttribute("style", before);
    }, measured.before);
  }
}

/** The observed moderate counts of this run, for `CUBIT_AXE_BUDGET_SEED=1`. */
const seed = new Map<string, number>();

/** Write the seed file after each checkpoint, so a run killed part-way still leaves what it read. */
function recordSeed(name: string, moderate: number): void {
  if (process.env["CUBIT_AXE_BUDGET_SEED"] !== "1") return;
  seed.set(name, moderate);
  const path = resolve(process.cwd(), "test-results", "axe-budget.seed.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(Object.fromEntries([...seed].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), null, 1)}\n`, "utf8");
}

/**
 * The showreel's chapter mark. `page.screencast.showChapter(title, { description })` is a 1.62 API
 * (playwright-core types.d.ts:18192) and it is called only when the run asked for a showreel — it
 * paints a titled overlay over the video for ~2 s, which is a lie in every run that is not being
 * filmed. Guarded on the API EXISTING as well as on the flag, so a Playwright without `screencast`
 * costs a journey nothing.
 */
async function markChapter(page: Page, testInfo: TestInfo, name: string, description: string): Promise<void> {
  if (process.env["CUBIT_SHOWREEL"] !== "1") return;
  // The reporter cannot see a call; it can see an annotation. The chapter is recorded in epoch ms
  // and turned into an offset into the video by the reporter, which is the only place that knows
  // when the recording started (TestResult.startTime).
  testInfo.annotations.push({ type: "showreel-chapter", description: JSON.stringify({ checkpoint: name, atMs: Date.now() }) });
  const screencast = (page as Page & { screencast?: { showChapter?: (title: string, options?: { description?: string; duration?: number }) => Promise<void> } }).screencast;
  if (typeof screencast?.showChapter !== "function") return;
  await screencast.showChapter(name, { description });
}

/** Attach the capture this checkpoint is named for, then judge the screen with axe. */
export async function checkpoint(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  // Everything below reads a screen, so everything below waits for one. Once, here.
  await settled(page);
  await markChapter(page, testInfo, name, `${testInfo.title} — checkpoint ${name}`);

  // The runner arrives over CDP, never as a `<script>` element: `addScriptTag` appends an inline
  // script and the shipped policy's script-src admits none (Q-12), while `evaluate` is not governed
  // by CSP — so the page axe judges is the page under the real policy. The tag set rides through
  // the same door as the source, as the run options.
  await page.evaluate(axe.source);
  const violations = (await page.evaluate(async (tags) => {
    const runner = (globalThis as unknown as { axe: { run: (context: Document, options: { runOnly: { type: "tag"; values: readonly string[] } }) => Promise<{ violations: AxeViolation[] }> } }).axe;
    const results = await runner.run(document, { runOnly: { type: "tag", values: tags } });
    return results.violations;
  }, TAGS)) as AxeViolation[];

  const root = await captureRoot(page);
  const capture = await captureScreen(page, root);
  await testInfo.attach(name, { body: capture.body, contentType: "image/png" });

  // The axe result rides beside the capture as its own attachment (Vextrus Builder v21 L9): the
  // evidence pack renders it next to the frame; it was asserted here and kept nowhere before.
  const moderate = violations.filter((violation) => violation.impact === "moderate");
  const budget = moderateBudgetFor(name);
  await testInfo.attach(`${name}.axe`, {
    body: JSON.stringify({ checkpoint: name, tags: TAGS, capture: { selector: capture.selector, contentHeight: capture.contentHeight, cap: capture.cap }, moderate: { count: moderate.length, budget }, violations }, null, 1),
    contentType: "application/json",
  });
  recordSeed(name, moderate.length);

  // §9.3: a taller capture fails the run. The picture is attached FIRST so the failure ships with
  // the evidence of what was too tall.
  expect(capture.contentHeight, `checkpoint ${name}: the screen's scroll container (${capture.selector}) is ${capture.contentHeight} px against a cap of ${capture.cap} px — a capture taller than twice the viewport is a picture of a scroll, not of a screen (Design Direction 00 §9.3)`).toBeLessThanOrEqual(capture.cap);

  const blocking = violations.filter((violation) => BLOCKING.has(violation.impact ?? ""));
  expect(blocking.map(describe), `checkpoint ${name}: axe reports no serious or critical violation`).toEqual([]);

  if (budget !== null) {
    expect(moderate.length, `checkpoint ${name}: ${moderate.length} moderate violation(s) against a budget of ${budget} — ${moderate.map(describe).join(" | ")}`).toBeLessThanOrEqual(budget);
  }
}
