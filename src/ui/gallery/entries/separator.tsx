/** Separator — the hairline between two things, lying either way (§5). */
import { Separator } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

const before = (): string => gs('gallery.sample.separator.before');
const after = (): string => gs('gallery.sample.separator.after');

export const entry: GalleryEntry = {
  id: 'separator',
  covers: ['Separator'],
  states: [
    {
      name: 'horizontal',
      render: () => (
        <span className="datum-gallery-stack">
          {before()}
          <Separator />
          {after()}
        </span>
      ),
    },
    {
      name: 'vertical',
      render: () => (
        <span className="datum-gallery-row">
          {before()}
          <Separator orientation="vertical" />
          {after()}
        </span>
      ),
    },
  ],
};
