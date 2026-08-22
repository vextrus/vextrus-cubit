/**
 * The lane's accessibility check — V-E2E: "axe on every checkpoint page".
 *
 * It lives here, once, so that a journey never builds an AxeBuilder of its own: a helper
 * every checkpoint calls is a helper that can be proved to fire (tests/e2e/harness.spec.ts
 * does exactly that, in both directions), and twelve hand-rolled builders cannot be.
 *
 * No rule set is narrowed and no violation is filtered. A page that needs an exception has
 * an accessibility defect, and the place to record that is the increment that renders the
 * page, not a quiet allowlist in the lane everybody trusts.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** What axe calls a violation, read off the builder rather than off a package of its own. */
type AxeViolation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

/** Every violation, said in the words axe used, so a red run is actionable from the log. */
function describeViolations(violations: readonly AxeViolation[]): string {
  return violations
    .map((violation) => {
      const where = violation.nodes.map((node) => node.target.join(' ')).join(', ');
      return `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} — ${where}`;
    })
    .join('\n');
}

/**
 * Rejects with the violation list if axe finds anything on the page as it stands.
 *
 * The page must come from a browser *context* — `@axe-core/playwright` refuses a page made
 * by `browser.newPage()`. Playwright's own `page` fixture is always context-made, so a
 * journey gets this for free; a suite that drives chromium by hand has to make a context.
 */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations;
  expect(
    violations.map((violation) => violation.id),
    `axe found ${violations.length} violation(s) on ${page.url()}:\n${describeViolations(violations)}`,
  ).toEqual([]);
}
