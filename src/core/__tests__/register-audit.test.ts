/**
 * The register's verdict, judged on lists nobody had to arrange on disk (Q-07).
 *
 * `auditRefusalRegister` was extracted from the register test "so its behaviour is testable
 * without touching the tree". The register itself only ever hands it the real tree, which is
 * clean — so `ok === true` is the only branch that file can reach, and a swapped set
 * difference or a dropped `.sort()` would sit there green. This file feeds it synthetic
 * lists and walks the branches the clean tree never reaches.
 *
 * Every code below is a fixture name, deliberately shaped like a refusal and deliberately
 * not one: the exercised scan reads whole test text and cannot tell a fixture from a claim,
 * so a real code named here would be a code excusing itself.
 */
import { describe, expect, it } from 'vitest';

import { auditRefusalRegister } from '../errors';

const A = 'FIXTURE_ALPHA';
const B = 'FIXTURE_BRAVO';
const C = 'FIXTURE_CHARLIE';

/** The clean input, as a base to perturb one list at a time. */
const clean = { registered: [], exercised: [], deferred: [], spelledInSource: [] } as const;

describe('auditRefusalRegister — the failing directions', () => {
  it('calls a registered code unexercised when no test and no deferral names it', () => {
    const result = auditRefusalRegister({ ...clean, registered: [A] });
    expect(result.unexercised).toEqual([A]);
    expect(result.danglingDeferrals).toEqual([]);
    expect(result.orphans).toEqual([]);
    expect(result.ok).toBe(false);
  });

  it('accounts for a registered code named by a test, or named by a deferral', () => {
    // Either direction discharges the obligation; L-QTY-04 puts them side by side.
    expect(
      auditRefusalRegister({ ...clean, registered: [A], exercised: [A] }).unexercised,
    ).toEqual([]);
    expect(auditRefusalRegister({ ...clean, registered: [A], deferred: [A] }).unexercised).toEqual(
      [],
    );
  });

  it('calls a deferral dangling when it names a code the registry does not hold', () => {
    const result = auditRefusalRegister({ ...clean, registered: [A], deferred: [A, B] });
    expect(result.danglingDeferrals).toEqual([B]);
    expect(result.unexercised).toEqual([]);
    expect(result.orphans).toEqual([]);
    expect(result.ok).toBe(false);
  });

  it('calls a source-spelled literal an orphan when the registry does not know it', () => {
    const result = auditRefusalRegister({
      ...clean,
      registered: [A],
      exercised: [A],
      spelledInSource: [A, B],
    });
    expect(result.orphans).toEqual([B]);
    expect(result.unexercised).toEqual([]);
    expect(result.danglingDeferrals).toEqual([]);
    expect(result.ok).toBe(false);
  });

  it('keeps the two directions apart', () => {
    // The settled reading of Q-07: registered-but-untested and spelled-but-unregistered are
    // opposite findings. A registered code absent from source is not an orphan, and a code
    // spelled in source and exercised is not unexercised — swapping either difference, or
    // folding them into one list, breaks exactly here.
    const result = auditRefusalRegister({
      registered: [A],
      exercised: [A],
      deferred: [],
      spelledInSource: [B],
    });
    expect(result.unexercised).toEqual([]);
    expect(result.orphans).toEqual([B]);
  });

  it('reports every finding at once, not the first one', () => {
    const result = auditRefusalRegister({
      registered: [A],
      exercised: [],
      deferred: [C],
      spelledInSource: [B],
    });
    expect(result.unexercised).toEqual([A]);
    expect(result.danglingDeferrals).toEqual([C]);
    expect(result.orphans).toEqual([B]);
    expect(result.ok).toBe(false);
  });

  it('is ok only when all three findings are empty', () => {
    expect(
      auditRefusalRegister({
        registered: [A, B],
        exercised: [A],
        deferred: [B],
        spelledInSource: [A, B],
      }).ok,
    ).toBe(true);
    expect(auditRefusalRegister(clean).ok).toBe(true);
    for (const broken of [
      { ...clean, registered: [A] },
      { ...clean, deferred: [A] },
      { ...clean, spelledInSource: [A] },
    ]) {
      expect(auditRefusalRegister(broken).ok).toBe(false);
    }
  });
});

describe('auditRefusalRegister — the shape of a finding', () => {
  it('sorts each finding and drops duplicates, whatever order the caller collected in', () => {
    // "sorted, duplicate-free" is an interface promise: a failure has to read the same twice,
    // however the tree happened to be walked.
    const result = auditRefusalRegister({
      registered: [C, A, C, B],
      exercised: [],
      deferred: [C, B, C],
      spelledInSource: [C, A, B, A],
    });
    expect(result.unexercised).toEqual([A]);
    expect(result.danglingDeferrals).toEqual([]);
    expect(result.orphans).toEqual([]);

    const dangling = auditRefusalRegister({
      ...clean,
      deferred: [C, A, B, A],
      spelledInSource: [C, A, B, A],
    });
    expect(dangling.danglingDeferrals).toEqual([A, B, C]);
    expect(dangling.orphans).toEqual([A, B, C]);
  });

  it('leaves the caller’s lists alone', () => {
    // Pure: the verdict is a function of the lists, and the lists come back as they went in.
    const registered = [C, A];
    const spelledInSource = [B, A];
    auditRefusalRegister({ registered, exercised: [], deferred: [], spelledInSource });
    expect(registered).toEqual([C, A]);
    expect(spelledInSource).toEqual([B, A]);
  });
});
