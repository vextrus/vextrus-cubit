/**
 * BasisChip, CoverageChip and UnitBadge — the three data marks (R-UI-010).
 *
 * All three say one fact and stop. That is the whole design: a chip that summarised, averaged
 * or interpreted would be putting a judgement where a reader expects a reading, and the
 * document a reader signs is made of readings.
 *
 * Numbers reach them through SEAM-FORMAT and nowhere else (L-FMT-01): a count is stringified
 * first because `formatNumber` takes exactly the kind's fraction digits — zero for a count —
 * and a unit is `formatUnit`'s rendering of the closed enum, never a caller's spelling
 * (L-FMT-02).
 *
 * Decided in docs/design/datum-patterns.md §5.
 */
import type { ReactElement } from 'react';
import { BasisMark } from '../basis';
import type { BasisCode } from '../tokens';
import { t } from '../strings';
import type { StringKey } from '../strings';
import { formatNumber, formatUnit } from '../../core/format';
import type { Unit } from '../../core/format';
import { cx } from '../primitives/class-names';
import { ds } from './strings';

/** The registered label of one basis — the same key BasisMark names its own mark with. */
const labelKey = (basis: BasisCode): StringKey =>
  `tokens.basis.${basis.toLowerCase() as Lowercase<BasisCode>}`;

/**
 * The space between two words of an enumeration. Written once, as a constant, because it is
 * punctuation rather than copy — R-SPINE-060 keeps words in the table, and a lone space in
 * JSX is a space a formatter is free to move.
 */
const SPACE = ' ';

/** A whole number as the document writes it (R-SPINE-061: lakh/crore, through the seam). */
export function countText(value: number): string {
  return formatNumber(String(value), 'count');
}

export interface BasisChipProps {
  /** Which of the seven (R-UI-002). An unregistered code throws, through BasisMark. */
  readonly basis: BasisCode;
}

export function BasisChip({ basis }: BasisChipProps): ReactElement {
  return (
    <span data-testid="basis-chip" data-basis={basis} className={cx('datum-chip', 'datum-basis-chip')}>
      {/* The mark carries its own `aria-label`; beside the label it would be announced twice,
          so inside a chip the glyph is decoration and the words are the name. */}
      <span aria-hidden="true" className="datum-chip-mark">
        <BasisMark basis={basis} />
      </span>
      <span className="datum-chip-label">{t(labelKey(basis))}</span>
    </span>
  );
}

export interface CoverageChipProps {
  /** How many of the things are covered. */
  readonly covered: number;
  /** How many there are. */
  readonly total: number;
}

export function CoverageChip({ covered, total }: CoverageChipProps): ReactElement {
  // "N of M", never "x%". The enumeration is the fact; a ratio is an interpretation, and a
  // reader who wants one can make it from two counts they can also check.
  return (
    <span data-testid="coverage-chip" className={cx('datum-chip', 'datum-coverage-chip')}>
      <span className="numeric">{countText(covered)}</span>
      {SPACE}
      <span className="datum-chip-word">{ds('data.coverage.of')}</span>
      {SPACE}
      <span className="numeric">{countText(total)}</span>
    </span>
  );
}

export interface UnitBadgeProps {
  /** One of the closed unit enum's five (L-FMT-02). */
  readonly unit: Unit;
}

export function UnitBadge({ unit }: UnitBadgeProps): ReactElement {
  return (
    <span
      data-testid="unit-badge"
      data-unit={unit}
      className={cx('datum-chip', 'datum-unit-badge', 'numeric')}
    >
      {formatUnit(unit)}
    </span>
  );
}
