/** EmptyState — a list with nothing in it, teaching the next action (§5). */
import { EmptyState } from '../../patterns';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The sheet uploads nothing: the action is here to be seen and named, not to act. */
const act = (): void => undefined;

const title = (): string => gs('gallery.sample.empty-state.title');
const teach = (): string => gs('gallery.sample.empty-state.teach');

export const entry: GalleryEntry = {
  id: 'empty-state',
  covers: ['EmptyState'],
  states: [
    { name: 'default', render: () => <EmptyState title={title()} teach={teach()} /> },
    {
      name: 'with-action',
      render: () => (
        <EmptyState
          title={title()}
          teach={teach()}
          actionLabel={gs('gallery.sample.empty-state.action')}
          onAction={act}
        />
      ),
    },
  ],
};
