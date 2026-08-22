/** Badge — the five tones a status can carry (§5). */
import { Badge } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

export const entry: GalleryEntry = {
  id: 'badge',
  covers: ['Badge'],
  states: [
    { name: 'neutral', render: () => <Badge>{gs('gallery.sample.badge.neutral')}</Badge> },
    {
      name: 'success',
      render: () => <Badge tone="success">{gs('gallery.sample.badge.success')}</Badge>,
    },
    { name: 'warn', render: () => <Badge tone="warn">{gs('gallery.sample.badge.warn')}</Badge> },
    {
      name: 'danger',
      render: () => <Badge tone="danger">{gs('gallery.sample.badge.danger')}</Badge>,
    },
    { name: 'info', render: () => <Badge tone="info">{gs('gallery.sample.badge.info')}</Badge> },
  ],
};
