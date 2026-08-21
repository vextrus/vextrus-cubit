/**
 * RefusalState's refusal: a code the register does not carry throws (R-UI-020, §8).
 *
 * The Increment Spec's interfaces line says RefusalState "throws on a code absent from
 * REFUSALS", the way BasisMark throws on a basis outside the seven (the precedent this follows
 * is src/ui/__tests__/basis-unknown-code.test.ts, including its cast). TypeScript's closed
 * `RefusalCode` union catches it for TypeScript callers, so the guard exists for the ones the
 * compiler never sees: a code off the wire, a column read from Postgres, a JavaScript caller.
 *
 * Without a test the guard is invisible to a refactor: rendering a blank card would keep every
 * other suite green while a refusal nobody registered reaches a reader with no message and no
 * remedy — a reader cannot tell that from a real one, which is what L-QTY-04's closed enum is
 * there to prevent.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { REFUSAL_CODES } from '../../../core/errors';
import type { RefusalCode } from '../../../core/errors';

const patternsModule = async () => await import('../index');

/** Shapes an unchecked value takes on the way in: absent, empty, mis-cased, plain wrong. */
const UNKNOWN = ['TENANT_ID_INVALIDD', 'tenant_id_invalid', '', 'NOT_A_REGISTERED_CODE'];

const HREF = '/trace/evidence';

describe('RefusalState refuses a code the register does not carry (R-UI-020)', () => {
  it('throws, naming the code, rather than rendering an empty refusal', async () => {
    const { RefusalState } = await patternsModule();

    for (const code of UNKNOWN) {
      expect(
        () =>
          renderToStaticMarkup(
            createElement(RefusalState, { code: code as RefusalCode, evidenceHref: HREF }),
          ),
        `RefusalState rendered instead of throwing for ${JSON.stringify(code)}`,
      ).toThrow(/[Uu]nknown refusal/);
    }
  });

  it('still renders every registered code, so the guard is a guard and not a wall', async () => {
    const { RefusalState } = await patternsModule();

    for (const code of REFUSAL_CODES) {
      expect(
        renderToStaticMarkup(createElement(RefusalState, { code, evidenceHref: HREF })),
      ).toContain(code);
    }
  });
});
