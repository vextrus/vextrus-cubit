/** Progress — nothing done, half done, done (§5). */
import { Progress } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

const TOTAL = 100;
const NONE = 0;
const HALF = 50;

const name = (): string => gs('gallery.sample.progress.name');

export const entry: GalleryEntry = {
  id: 'progress',
  covers: ['Progress'],
  states: [
    { name: 'zero', render: () => <Progress aria-label={name()} value={NONE} max={TOTAL} /> },
    { name: 'half', render: () => <Progress aria-label={name()} value={HALF} max={TOTAL} /> },
    { name: 'full', render: () => <Progress aria-label={name()} value={TOTAL} max={TOTAL} /> },
  ],
};
