/** IconButton — a glyph with a required name (§5). */
import { X } from 'lucide-react';
import { IconButton } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

const ICON = 16;

const label = (): string => gs('gallery.sample.icon-button.label');

export const entry: GalleryEntry = {
  id: 'icon-button',
  covers: ['IconButton'],
  states: [
    { name: 'default', render: () => <IconButton label={label()} icon={<X size={ICON} />} /> },
    {
      name: 'disabled',
      render: () => <IconButton disabled label={label()} icon={<X size={ICON} />} />,
    },
  ],
};
