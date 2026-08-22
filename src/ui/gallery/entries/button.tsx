/** Button — the four variants, the icon, the two states an act puts it in (§5). */
import { Plus } from 'lucide-react';
import { Button } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The glyph's box, in px: a layout dimension, not a token role (§9). */
const ICON = 16;

const label = (): string => gs('gallery.sample.button.label');

export const entry: GalleryEntry = {
  id: 'button',
  covers: ['Button'],
  states: [
    { name: 'primary', render: () => <Button>{label()}</Button> },
    { name: 'secondary', render: () => <Button variant="secondary">{label()}</Button> },
    { name: 'ghost', render: () => <Button variant="ghost">{label()}</Button> },
    {
      name: 'danger',
      render: () => <Button variant="danger">{gs('gallery.sample.button.danger')}</Button>,
    },
    {
      name: 'with-icon',
      render: () => <Button icon={<Plus size={ICON} />}>{label()}</Button>,
    },
    { name: 'disabled', render: () => <Button disabled>{label()}</Button> },
    { name: 'loading', render: () => <Button loading>{label()}</Button> },
  ],
};
