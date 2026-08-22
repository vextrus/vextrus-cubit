/** PartialNotice — some rows were refused, and they are shown, not hidden (§5). */
import { PartialNotice } from '../../patterns';
import type { GalleryEntry } from '../types';

const REFUSED = 2;

export const entry: GalleryEntry = {
  id: 'partial-notice',
  covers: ['PartialNotice'],
  states: [{ name: 'default', render: () => <PartialNotice refusedCount={REFUSED} /> }],
};
