// @vitest-environment jsdom
/**
 * The count seam takes exactly zero fraction digits (L-FMT-01), and every count these two
 * modules render goes through it: a coverage chip's two numbers, a partial notice's refused
 * count, a consequence line. The props are typed `number`, so a caller's computed float — a
 * ratio, an average, a division that did not land whole — reaches the seam and is refused.
 *
 * A component that throws a seam error mid-render takes the screen down over a rounding
 * question. §1 decides the reading: a count is a whole number, so the nearest one is what is
 * written down. This suite is that decision, exercised from the barrels.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

type DataModule = typeof import('../../data/index');
type PatternsModule = typeof import('../index');

const dataModule = async (): Promise<DataModule> => await import('../../data/index');
const patternsModule = async (): Promise<PatternsModule> => await import('../index');

/**
 * Counts a caller computed rather than counted: none is a whole number. Read from text rather
 * than written as fractional literals — B-07 keeps float literals out of this tree, and what
 * these fixtures stand for is a number that arrived from somewhere, not one anybody typed.
 */
const FRACTIONAL_COVERED = Number('3.4');
const FRACTIONAL_TOTAL = Number('7.6');
const FRACTIONAL_REFUSED = Number('1.5');

const ROUNDED_COVERED = '3';
const ROUNDED_TOTAL = '8';
const ROUNDED_REFUSED = '2';

afterEach(cleanup);

describe('CoverageChip — a fractional count reads as a count (§1)', () => {
  it('rounds to the whole number the enumeration is made of', async () => {
    const { CoverageChip } = await dataModule();
    render(<CoverageChip covered={FRACTIONAL_COVERED} total={FRACTIONAL_TOTAL} />);

    const text = screen.getByTestId('coverage-chip').textContent ?? '';
    expect(text).toContain(ROUNDED_COVERED);
    expect(text).toContain(ROUNDED_TOTAL);
  });
});

describe('PartialNotice — a fractional refused count renders (§7)', () => {
  it('says how many rows to look for instead of throwing from the seam', async () => {
    const { PartialNotice } = await patternsModule();
    render(<PartialNotice refusedCount={FRACTIONAL_REFUSED} />);

    expect(screen.getByTestId('partial-notice').textContent ?? '').toContain(ROUNDED_REFUSED);
  });
});
