/**
 * BasisChip — one chip per basis code (§5).
 *
 * The seven states are derived from the code list rather than written out one by one: the
 * state name is the code in lower case, so a basis that lands later draws itself.
 */
import { BasisChip } from '../../data';
import type { BasisCode } from '../../tokens';
import type { GalleryEntry } from '../types';

/** The seven codes R-UI-002 fixes, in the register's order. */
const CODES: readonly BasisCode[] = [
  'MEASURED',
  'TRANSCRIBED',
  'DERIVED',
  'IMPORTED',
  'ENTERED',
  'INTERPRETED',
  'DEFAULTED',
];

export const entry: GalleryEntry = {
  id: 'basis-chip',
  covers: ['BasisChip'],
  states: CODES.map((code) => ({
    name: code.toLowerCase(),
    render: () => <BasisChip basis={code} />,
  })),
};
