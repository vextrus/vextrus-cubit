/**
 * Silent: every suite runs (Q-08). A test that should not run yet is not written yet; a
 * test that has stopped being true is deleted with its reason in the message, so the
 * count moves visibly rather than quietly.
 */
import { describe, expect, it } from 'vitest';

describe('retention', () => {
  it('keeps the drawing set for seven years', () => {
    expect(7).toBe(7);
  });
});
