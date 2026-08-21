/**
 * BasisMark's refusal: a code outside the fixed seven throws (R-UI-002, design decision §6/§8).
 *
 * The declared interface for src/ui/basis.tsx says "throws on unknown codes", and the design
 * decision calls it the one runtime state this increment owns. TypeScript's closed `BasisCode`
 * union catches it at compile time for TypeScript callers, so the runtime guard exists for the
 * ones the compiler never sees: JSON off the wire, a basis column read from Postgres, a
 * JavaScript caller. Without a test the guard is invisible to a refactor — returning blank
 * markup would keep every other suite green while a wrong basis renders as a plausible mark,
 * which is exactly what R-UI-002's pair is there to prevent.
 *
 * The cast is deliberate and is the whole point: it is how an unchecked value arrives.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BasisCode } from '../tokens';

const basisModule = async () => await import('../basis');

/** Shapes an unchecked value takes on the way in: absent, empty, mis-cased, plain wrong. */
const UNKNOWN = ['ESTIMATED', 'measured', '', 'UNKNOWN'];

describe('BasisMark refuses a code outside the fixed seven (R-UI-002)', () => {
  it('throws, naming the offending code, rather than rendering a plausible mark', async () => {
    const { BasisMark } = await basisModule();

    for (const code of UNKNOWN) {
      expect(
        () => renderToStaticMarkup(createElement(BasisMark, { basis: code as BasisCode })),
        `BasisMark rendered instead of throwing for ${JSON.stringify(code)}`,
      ).toThrow(/[Uu]nknown basis/);
    }
  });

  it('still renders the seven, so the guard is a guard and not a wall', async () => {
    const { BasisMark } = await basisModule();
    const { BASIS } = await import('../tokens');

    for (const code of Object.keys(BASIS) as BasisCode[]) {
      expect(renderToStaticMarkup(createElement(BasisMark, { basis: code }))).toContain(
        `data-basis="${code}"`,
      );
    }
  });
});
