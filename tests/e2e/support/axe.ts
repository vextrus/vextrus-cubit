import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Q-11 / R-UI-012 / R-UI-060 — axe serious/critical must be zero on every
 * screen. Run at every named checkpoint, never sampled.
 */
export async function expectNoSeriousAxeViolations(page: Page, checkpoint: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );

  const report = blocking
    .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
    .join('\n');

  expect(report, `axe serious/critical violations at checkpoint ${checkpoint}`).toBe('');
}
