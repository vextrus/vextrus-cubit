/** PermissionDenied — which permission, and who holds it (§5). */
import { PermissionDenied } from '../../patterns';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The permission's registered name: a code, rendered verbatim (R-SPINE-060). */
const PERMISSION = 'estimate.sign';

export const entry: GalleryEntry = {
  id: 'permission-denied',
  covers: ['PermissionDenied'],
  states: [
    {
      name: 'default',
      render: () => (
        <PermissionDenied
          permission={PERMISSION}
          holder={gs('gallery.sample.permission-denied.holder')}
        />
      ),
    },
  ],
};
