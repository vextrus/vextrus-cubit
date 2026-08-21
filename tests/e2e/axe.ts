/**
 * axe at every journey checkpoint (Q-11, V-E2E).
 *
 * Q-11: "axe: zero serious/critical on every journey checkpoint". So the check is not a
 * report a reader has to remember to open — a serious or critical violation throws, the
 * journey goes red, and the message names the checkpoint and the rule ids so the failure is
 * actionable from the log alone. Minor and moderate findings are counted by the design
 * review, not by the gate; this helper is Q-11's exact line and nothing wider.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** The two severities Q-11 names. */
const BLOCKING: readonly string[] = ['serious', 'critical'];

/**
 * Scan the page as it stands and throw if anything serious or critical is on it.
 *
 * `checkpoint` is the journey's own name for this moment (`gallery-light`), so a failure
 * says which screenshot the reader should be looking at.
 */
export async function expectNoSeriousOrCritical(page: Page, checkpoint: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter((violation) =>
    BLOCKING.includes(violation.impact ?? ''),
  );
  if (blocking.length === 0) return;
  const named = blocking
    .map((violation) => `${violation.id} (${violation.impact ?? ''}, ${String(violation.nodes.length)} nodes)`)
    .join(', ');
  throw new Error(`Q-11: axe found serious/critical violations at ${checkpoint}: ${named}`);
}
