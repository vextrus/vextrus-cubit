/** Kbd — a key, and the pair a shortcut is written as (§5). */
import { Kbd } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

export const entry: GalleryEntry = {
  id: 'kbd',
  covers: ['Kbd'],
  states: [
    {
      name: 'default',
      render: () => (
        <span className="datum-gallery-row">
          <Kbd>{gs('gallery.sample.kbd.modifier')}</Kbd>
          <Kbd>{gs('gallery.sample.kbd.letter')}</Kbd>
        </span>
      ),
    },
  ],
};
