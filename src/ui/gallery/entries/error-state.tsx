/** ErrorState — what failed, how to try again, and the id support will ask for (§5). */
import { ErrorState } from '../../patterns';
import type { GalleryEntry } from '../types';

/** The sample report id: a code, rendered verbatim (R-SPINE-060). */
const REPORT_ID = 'RPT-3412';

const retry = (): void => undefined;

export const entry: GalleryEntry = {
  id: 'error-state',
  covers: ['ErrorState'],
  states: [
    { name: 'default', render: () => <ErrorState reportId={REPORT_ID} onRetry={retry} /> },
  ],
};
