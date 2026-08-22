/** Tag — a label, and the same label with the control that takes it off (§5). */
import { Tag } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The sheet takes nothing off: the control is here to be seen and named, not to act. */
const remove = (): void => undefined;

const label = (): string => gs('gallery.sample.tag.label');

export const entry: GalleryEntry = {
  id: 'tag',
  covers: ['Tag'],
  states: [
    { name: 'default', render: () => <Tag>{label()}</Tag> },
    { name: 'removable', render: () => <Tag onRemove={remove}>{label()}</Tag> },
  ],
};
