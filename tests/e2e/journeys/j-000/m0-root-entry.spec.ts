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

/** What the document's ground actually resolved to, read off `html` in the running browser. */
interface Ground {
  /** The value `--graphite-0` carries on `:root` — empty when tokens.css never loaded. */
  token: string;
  /** `html`'s computed `background-color`. */
  painted: string;
  /** The same token value pushed through the browser's own colour parser, for comparison. */
  expected: string;
}

/**
 * Read the ground from the document. The comparison is deliberately not "light differs from dark":
 * a `color-scheme` flip alone repaints the UA canvas even with no token loaded at all, so the
 * assertion binds `html`'s painted background to the *value* `--graphite-0` resolves to.
 */
async function groundOf(page: Page): Promise<Ground> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const token = computed.getPropertyValue("--graphite-0").trim();
    const probe = document.createElement("span");
    probe.style.backgroundColor = token;
    document.body.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { token, painted: computed.backgroundColor, expected };
  });
}

/**
 * "Before first paint" is a claim about the *served document*, not about what an attribute reads
 * once the page has settled: every late resolver — the same script emitted after `{children}`, one
 * wrapped in a load listener, a client component flipping the attribute on mount — leaves
 * `data-theme` correct by the time a post-load assertion runs, while painting the wrong theme
 * first. So the source itself is read: the resolver must be a blocking inline `<script>` standing
 * ahead of anything that can paint, exactly as the Design Decision's theme-resolution section
 * fixes it (R-UI-001, AC-2).
 */
async function assertResolverRunsBeforeFirstPaint(page: Page, checkpoint: string): Promise<void> {
  const response = await page.request.get("/");
  expect(response.ok(), `/ must be served for the source read (${checkpoint})`).toBe(true);
  const html = await response.text();

  const bodyOpen = /<body\b[^>]*>/.exec(html);
  expect(bodyOpen, "the served document has a <body>").not.toBeNull();
  const body = html.slice((bodyOpen as RegExpExecArray).index + (bodyOpen as RegExpExecArray)[0].length);

  // The resolver, found by what it does rather than by where it is — so a mis-placed one is found
  // and then failed, not merely missed.
  const inlineScript = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
  let resolver: { attrs: string; code: string; index: number } | null = null;
  for (let match = inlineScript.exec(body); match !== null; match = inlineScript.exec(body)) {
    if (match[2].includes("data-theme")) {
      resolver = { attrs: match[1], code: match[2], index: match.index };
      break;
    }
  }
  expect(resolver, `the theme resolver is an inline <script> in <body> (${checkpoint})`).not.toBeNull();
  const { attrs, code, index } = resolver as { attrs: string; code: string; index: number };

  // Blocking: the parser must stop and run it. `defer`, `async` and `type="module"` all release the
  // parser and let content paint first.
  expect(/\b(?:defer|async)\b/.test(attrs), `the resolver script blocks the parser (${checkpoint})`).toBe(false);
  expect(/type\s*=\s*"module"/.test(attrs), `the resolver script is not a module (${checkpoint})`).toBe(false);

  // …and the code itself must not hand the work to a later turn.
  expect(
    /addEventListener|DOMContentLoaded|onload|setTimeout|requestAnimationFrame|requestIdleCallback/.test(code),
    `the resolver runs inline, not from a deferred callback (${checkpoint})`,
  ).toBe(false);

  // First child of <body>: nothing that can paint precedes it. React's own hidden bookkeeping div
  // and its comment markers render nothing, so they are the only lawful company ahead of it.
  const ahead = body
    .slice(0, index)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<div hidden(?:="")?>\s*<\/div>/g, "")
    .trim();
  expect(ahead, `nothing paintable precedes the theme resolver in <body> (${checkpoint})`).toBe("");

  const landmark = body.indexOf('data-testid="root-home-main"');
  expect(landmark, "the landmark is in the served document").toBeGreaterThan(-1);
  expect(index, `the resolver is emitted before {children} (${checkpoint})`).toBeLessThan(landmark);
}

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
async function rootEntry(
  browser: Browser,
  baseURL: string,
  colorScheme: "light" | "dark",
  checkpoint: string,
  testInfo: TestInfo,
): Promise<{ capture: Buffer; ground: Ground }> {
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
    expect(theme, `the document resolves the ${colorScheme} theme (R-UI-001)`).toBe(colorScheme);
    await assertResolverRunsBeforeFirstPaint(page, checkpoint);

    const ground = await groundOf(page);
    expect(ground.token, `tokens.css is loaded on the document — --graphite-0 has a value (${checkpoint})`).not.toBe("");
    expect(ground.painted, `the ${checkpoint} ground is painted from --graphite-0, not the UA canvas`).toBe(ground.expected);

    const violations = await blockingViolations(page);
    expect(violations, `axe found serious/critical violations at / (${checkpoint}): ${JSON.stringify(violations)}`).toStrictEqual([]);

    const capture = await page.screenshot({ fullPage: true });
    await testInfo.attach(checkpoint, { body: capture, contentType: "image/png" });
    return { capture, ground };
  } finally {
    await context.close();
  }
}

test.describe("J-000 Golden Path", () => {
  test("J-000 root-entry: / renders the product's landmark, clean and themed both ways", async ({ browser, baseURL }, testInfo) => {
    const origin = String(baseURL);
    const light = await rootEntry(browser, origin, "light", "root-entry", testInfo);
    const dark = await rootEntry(browser, origin, "dark", "root-entry-dark", testInfo);

    // The token itself must flip under [data-theme="dark"] — this is what makes the two captures
    // differ. Without it, `color-scheme` alone would repaint the UA canvas and the byte comparison
    // below would pass on a document that never loaded a token (R-UI-001).
    expect(dark.ground.token, "--graphite-0 carries a different value in dark than in light").not.toBe(light.ground.token);
    expect(dark.ground.painted, "the dark ground is painted from the flipped token value").not.toBe(light.ground.painted);

    expect(light.capture.equals(dark.capture), "the dark capture must not be byte-identical to the light one — the ground flips with the token values").toBe(false);
  });
});
