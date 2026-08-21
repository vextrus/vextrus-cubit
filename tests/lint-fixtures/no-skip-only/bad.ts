// Q-08 fixture: a suite that quietly stops measuring.
// RECORDED REASON GUARDRAIL_FIXTURE — the markers below exist so that
// cubit/no-skip-only can be proved to fire on them (B-05, AC-2).
// docs/toolchain.md, "The recorded reason for the fixtures themselves".
import { describe, it, expect } from 'vitest';

describe.skip('retention', () => {
  it('holds five percent', () => {
    expect(true).toBe(true);
  });
});

describe('invoices', () => {
  it.only('is the only test that will run', () => {
    expect(true).toBe(true);
  });

  it('never runs', () => {
    expect(true).toBe(true);
  });
});
