/** RefusalState — the code, its message and its remedy, read off the register (§5). */
import { RefusalState } from '../../patterns';
import type { GalleryEntry } from '../types';

/** A registered refusal code, rendered verbatim (R-UI-020, R-SPINE-060). */
const CODE = 'STORAGE_URL_EXPIRED';

/** The Trace affordance's target: this sheet, which is where the sample lives. */
const EVIDENCE = '/design';

export const entry: GalleryEntry = {
  id: 'refusal-state',
  covers: ['RefusalState'],
  states: [
    { name: 'default', render: () => <RefusalState code={CODE} evidenceHref={EVIDENCE} /> },
  ],
};
