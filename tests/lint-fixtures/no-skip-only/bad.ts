// Q-08 fixture: a suite that quietly stops measuring.
// RECORDED REASON GUARDRAIL_FIXTURE — the marker below is the increment's one
// committed site for this rule; it exists so that cubit/no-skip-only can be
// proved to fire on a real file (B-05, AC-2). The rule's other branch — the
// exclusive marker, in dot and bracket form — is proved from source assembled
// at run time in tests/lint-fixtures/guardrails.test.ts.
// docs/toolchain.md, "The recorded reason for the fixtures themselves".
import { describe, it, expect } from 'vitest';

describe.skip('retention', () => { // RECORDED REASON GUARDRAIL_FIXTURE
  it('holds five percent', () => {
    expect(true).toBe(true);
  });
});
