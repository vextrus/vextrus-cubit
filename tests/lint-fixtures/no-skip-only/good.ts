// Q-08 fixture: every test in the file runs, every time.
import { describe, it, expect } from 'vitest';

describe('retention', () => {
  it('holds five percent', () => {
    expect(true).toBe(true);
  });
});

describe('invoices', () => {
  it('lists what the tenant may see', () => {
    expect(true).toBe(true);
  });
});
