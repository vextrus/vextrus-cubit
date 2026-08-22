/** Switch — a setting that takes effect as it is thrown (§5). */
import { Switch } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';
import { Labelled } from './labelled';

const label = (): string => gs('gallery.sample.switch.label');

export const entry: GalleryEntry = {
  id: 'switch',
  covers: ['Switch'],
  states: [
    {
      name: 'off',
      render: () => <Labelled label={label()} control={(id) => <Switch aria-labelledby={id} />} />,
    },
    {
      name: 'on',
      render: () => (
        <Labelled label={label()} control={(id) => <Switch defaultChecked aria-labelledby={id} />} />
      ),
    },
    {
      name: 'disabled',
      render: () => (
        <Labelled label={label()} control={(id) => <Switch disabled aria-labelledby={id} />} />
      ),
    },
  ],
};
