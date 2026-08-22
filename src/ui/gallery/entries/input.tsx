/** Input — a field holding a name, and the two states a form puts it in (§5). */
import { Input } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

const name = (): string => gs('gallery.sample.input.name');

export const entry: GalleryEntry = {
  id: 'input',
  covers: ['Input'],
  states: [
    {
      name: 'default',
      render: () => <Input aria-label={name()} defaultValue={gs('gallery.sample.input.value')} />,
    },
    {
      name: 'disabled',
      render: () => <Input disabled aria-label={name()} placeholder={name()} />,
    },
    {
      name: 'invalid',
      render: () => <Input aria-invalid aria-label={name()} placeholder={name()} />,
    },
  ],
};
