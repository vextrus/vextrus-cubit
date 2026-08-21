/**
 * Fires: cubit/no-skip-only (Q-08).
 *
 * RECORDED REASON GUARDRAIL_FIXTURE — the committed spelling of an excluded suite, kept
 * here and nowhere else so the rule can be proved against the construct itself. The file
 * is not collected by the runner: it is a lint input, excluded from the vitest include.
 */
import { describe, expect, it } from 'vitest';

describe.skip('retention', () => { // RECORDED REASON GUARDRAIL_FIXTURE
  it('keeps the drawing set for seven years', () => {
    expect(true).toBe(true);
  });
});
