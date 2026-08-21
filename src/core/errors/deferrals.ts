/**
 * Deferrals: registered codes that no test exercises yet, each with the reason why (Q-07).
 *
 * L-QTY-04 gives a code exactly two lawful states — "exercised by name in a test or deferred
 * by name" — so this list is the second one, written down. A deferral is a debt with a name
 * on it: the reason says what has to exist before the code can be exercised, and the register
 * refuses a deferral whose code is not registered, so the debt cannot outlive its code.
 *
 * Empty today, and that is the healthy state: both spine codes are exercised by
 * `src/core/__tests__/seam-refusals.test.ts`, which makes each of them actually fire.
 *
 * Frozen down to each row, like the registries: a list of debts an importer can edit is not a
 * closed taxonomy's ledger.
 */
import type { RefusalCode } from '../errors';

interface Deferral {
  readonly code: RefusalCode;
  readonly reason: string;
}

export const DEFERRED_REFUSALS: ReadonlyArray<Deferral> = Object.freeze(
  ([] as Deferral[]).map((deferral) => Object.freeze(deferral)),
);
