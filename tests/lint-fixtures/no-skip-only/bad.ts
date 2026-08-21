// Q-08 fixture: a suite that quietly stops measuring.
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
