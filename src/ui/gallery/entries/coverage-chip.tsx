/** CoverageChip — how many of the things are covered, as an enumeration (§5). */
import { CoverageChip } from '../../data';
import type { GalleryEntry } from '../types';

/** The sample reading the Design Decision fixes: 14 of 96. */
const COVERED = 14;
const TOTAL = 96;

export const entry: GalleryEntry = {
  id: 'coverage-chip',
  covers: ['CoverageChip'],
  states: [
    { name: 'default', render: () => <CoverageChip covered={COVERED} total={TOTAL} /> },
  ],
};
