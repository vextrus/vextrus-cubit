// @vitest-environment jsdom
/**
 * inc-006 acceptance — BasisChip, CoverageChip, UnitBadge and the src/ui/data barrel (AC-5).
 *
 * R-UI-010 lists all three on the roster; the Increment Spec's `interfaces` line fixes what
 * each renders: BasisChip "composes BasisMark", CoverageChip shows "enumeration text, never a
 * percentage", UnitBadge takes its "text via formatUnit from src/core/format.ts".
 *
 * The rules under the assertions, none of them a snapshot of today's tree:
 *   - every basis the token sheet registers gets a chip carrying that basis's mark, so the
 *     seven are covered by iterating the register rather than by listing them here;
 *   - a coverage chip states two counts in order and no percentage — and it states them in the
 *     document's own grouping (R-SPINE-061 lakh/crore), which is what `formatNumber(…,
 *     'count')` produces and what `Number.toLocaleString()` in an ambient locale would not;
 *   - a unit badge renders the closed enum's rendering (L-FMT-02), never a caller's spelling.
 *
 * The barrel roster is asserted as a floor. `src/ui/data` is a module later leaves keep
 * filling (Tree, Sparkline, the chart wrappers are named out of scope here); an assertion that
 * froze the export set would pass today and redden the first increment that lawfully adds to
 * it.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
// BasisCode and the basis register are declared in src/ui/tokens.ts, which src/ui/basis.tsx
// reads to build the mark; the Increment Spec names basis.tsx as the source of the code, and
// this is where that type lives.
import { BASIS } from '../../tokens';
import type { BasisCode } from '../../tokens';
import type { Unit } from '../../../core/format';

type DataModule = typeof import('../index');

/** The barrel, per test (see the file header). */
const dataModule = async (): Promise<DataModule> => await import('../index');

/** The Increment Spec's `interfaces` line for src/ui/data — read as a floor, never a ceiling. */
const ROSTER: readonly string[] = ['DataTable', 'BasisChip', 'CoverageChip', 'UnitBadge'];

/**
 * L-FMT-02's closed unit enum and the rendering `formatUnit` gives each one — the design
 * decision §5 states the same five verbatim. A caller's own spelling is not a unit.
 */
const UNITS: ReadonlyArray<readonly [Unit, string]> = [
  ['m', 'm'],
  ['m2', 'm²'],
  ['m3', 'm³'],
  ['kg', 'kg'],
  ['nos', 'nos'],
];

/**
 * A coverage wide enough to tell the document's grouping from an ambient one: R-SPINE-061
 * writes a lakh as 1,00,000, and `formatNumber(String(n), 'count')` is the only seam that may
 * write it at all.
 */
const COVERED = 100_000;
const TOTAL = 250_000;
const COVERED_TEXT = '1,00,000';
const TOTAL_TEXT = '2,50,000';

const text = (element: HTMLElement): string => (element.textContent ?? '').trim();

afterEach(cleanup);

describe('AC-5 — the src/ui/data barrel carries its roster (R-UI-010)', () => {
  it('exports every name the Increment Spec declares', async () => {
    const exported = new Set(Object.keys(await dataModule()));
    const missing = ROSTER.filter((name) => !exported.has(name));
    expect(missing, `src/ui/data/index.ts exports no: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('AC-5 — BasisChip composes the basis mark (R-UI-002, R-UI-010)', () => {
  it('renders a chip carrying that basis’s own mark, for every registered basis', async () => {
    const { BasisChip } = await dataModule();

    // The register is the roster: a basis added to src/ui/tokens.ts is covered here without
    // an edit, and a chip that invents its own glyph set is not.
    const codes = Object.keys(BASIS) as BasisCode[];
    expect(codes.length).toBeGreaterThan(0);

    for (const code of codes) {
      const view = render(<BasisChip basis={code} />);
      const chip = screen.getByTestId('basis-chip');
      const mark = within(chip).getByTestId('basis-mark');
      expect(
        mark.getAttribute('data-basis'),
        `the chip for ${code} does not carry that basis’s mark`,
      ).toBe(code);
      view.unmount();
    }
  });
});

describe('AC-5 — CoverageChip enumerates, never interprets (R-UI-010)', () => {
  it('states covered then total, through the count seam, with no percentage', async () => {
    const { CoverageChip } = await dataModule();
    render(<CoverageChip covered={COVERED} total={TOTAL} />);

    const chip = screen.getByTestId('coverage-chip');
    const reading = text(chip);

    // The document's grouping, which is the seam's — not the runtime's ambient locale.
    expect(reading, 'the covered count is not written the way the document writes it').toContain(
      COVERED_TEXT,
    );
    expect(reading, 'the total is not written the way the document writes it').toContain(
      TOTAL_TEXT,
    );
    expect(
      reading.indexOf(COVERED_TEXT),
      'the enumeration does not read covered-then-total',
    ).toBeLessThan(reading.indexOf(TOTAL_TEXT));

    // "enumeration text, never a percentage": a ratio is an interpretation this chip refuses
    // to add on the reader's behalf.
    expect(reading).not.toContain('%');
    expect(reading).not.toMatch(/\bpercent\b/i);
  });
});

describe('AC-5 — UnitBadge renders the closed enum (L-FMT-02, R-UI-010)', () => {
  it('shows exactly what formatUnit gives each unit', async () => {
    const { UnitBadge } = await dataModule();

    for (const [unit, rendering] of UNITS) {
      const view = render(<UnitBadge unit={unit} />);
      expect(text(screen.getByTestId('unit-badge')), `UnitBadge mis-renders ${unit}`).toBe(
        rendering,
      );
      view.unmount();
    }
  });

  it('mounts under both themes without throwing (R-UI-001)', async () => {
    const { BasisChip, CoverageChip, UnitBadge } = await dataModule();
    const codes = Object.keys(BASIS) as BasisCode[];
    const basis = codes[0];
    if (basis === undefined) throw new Error('the basis register is empty');
    const unit = UNITS[0]?.[0];
    if (unit === undefined) throw new Error('the unit roster is empty');

    const chips: ReactElement = (
      <div>
        <BasisChip basis={basis} />
        <CoverageChip covered={COVERED} total={TOTAL} />
        <UnitBadge unit={unit} />
      </div>
    );

    for (const theme of ['light', 'dark']) {
      const view = render(<div data-theme={theme}>{chips}</div>);
      expect(screen.getByTestId('basis-chip')).toBeDefined();
      expect(screen.getByTestId('coverage-chip')).toBeDefined();
      expect(screen.getByTestId('unit-badge')).toBeDefined();
      view.unmount();
    }
  });
});
