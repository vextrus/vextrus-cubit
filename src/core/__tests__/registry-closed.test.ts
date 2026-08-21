/**
 * "Closed" is a runtime property, not an annotation (R-SPINE-062).
 *
 * The types already stop a code being added or edited where a compiler is watching. This is
 * the other half: after import, the taxonomy is inert — no importer can add a code, drop one,
 * or rewrite a message, remedy, severity or surface.
 */
import { describe, expect, it } from 'vitest';

import { REFUSALS, REFUSAL_CODES } from '../errors';
import { DEFERRED_REFUSALS } from '../errors/deferrals';
import { SPINE_REFUSALS } from '../errors/spine';

describe('the composed registry is inert once imported', () => {
  it('freezes the table and every entry in it', () => {
    expect(Object.isFrozen(REFUSALS)).toBe(true);
    for (const code of REFUSAL_CODES) {
      expect(Object.isFrozen(REFUSALS[code])).toBe(true);
    }
  });

  it('freezes each module registry and its entries', () => {
    expect(Object.isFrozen(SPINE_REFUSALS)).toBe(true);
    for (const entry of Object.values(SPINE_REFUSALS)) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  it('freezes the code list and the deferral ledger', () => {
    expect(Object.isFrozen(REFUSAL_CODES)).toBe(true);
    expect(Object.isFrozen(DEFERRED_REFUSALS)).toBe(true);
    for (const deferral of DEFERRED_REFUSALS) {
      expect(Object.isFrozen(deferral)).toBe(true);
    }
  });
});
