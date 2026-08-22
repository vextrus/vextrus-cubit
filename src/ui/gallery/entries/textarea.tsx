/** Textarea — the same field, sized for a sentence (§5). */
import { Textarea } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

const name = (): string => gs('gallery.sample.textarea.name');
const value = (): string => gs('gallery.sample.textarea.value');

export const entry: GalleryEntry = {
  id: 'textarea',
  covers: ['Textarea'],
  states: [
    { name: 'default', render: () => <Textarea aria-label={name()} defaultValue={value()} /> },
    {
      name: 'disabled',
      render: () => <Textarea disabled aria-label={name()} defaultValue={value()} />,
    },
    {
      name: 'invalid',
      render: () => <Textarea aria-invalid aria-label={name()} defaultValue={value()} />,
    },
  ],
};
