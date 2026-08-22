/** OfflineBanner — the connection is gone and the screen says so (§5). */
import { OfflineBanner } from '../../patterns';
import type { GalleryEntry } from '../types';

export const entry: GalleryEntry = {
  id: 'offline-banner',
  covers: ['OfflineBanner'],
  states: [{ name: 'default', render: () => <OfflineBanner /> }],
};
