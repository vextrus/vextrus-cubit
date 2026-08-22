/**
 * Skeleton — the shape content will take, held while it loads (§5).
 *
 * The two bars carry their geometry inline: 240 × 16 and 160 × 16 are layout dimensions the
 * Design Decision states, not token roles (§9).
 */
import { Skeleton } from '../../primitives';
import type { GalleryEntry } from '../types';

const WIDE = { width: '240px', height: '16px' };
const NARROW = { width: '160px', height: '16px' };

export const entry: GalleryEntry = {
  id: 'skeleton',
  covers: ['Skeleton'],
  states: [
    {
      name: 'default',
      render: () => (
        <span className="datum-gallery-stack">
          <Skeleton style={WIDE} />
          <Skeleton style={NARROW} />
        </span>
      ),
    },
  ],
};
