/** Switch — a setting that takes effect as it is thrown (§5). */
import { Switch } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';
import { Labelled } from './labelled';

const label = (): string => gs('gallery.sample.switch.label');

/** One id per state cell, written rather than minted, so the sheet's markup never drifts. */
const labelId = (state: string): string => `gallery-labelled-switch-${state}`;

export const entry: GalleryEntry = {
  id: 'switch',
  covers: ['Switch'],
  states: [
    {
      name: 'off',
      render: () => (
        <Labelled
          id={labelId('off')}
          label={label()}
          control={(id) => <Switch aria-labelledby={id} />}
        />
      ),
    },
    {
      name: 'on',
      render: () => (
        <Labelled
          id={labelId('on')}
          label={label()}
          control={(id) => <Switch defaultChecked aria-labelledby={id} />}
        />
      ),
    },
    {
      name: 'disabled',
      render: () => (
        <Labelled
          id={labelId('disabled')}
          label={label()}
          control={(id) => <Switch disabled aria-labelledby={id} />}
        />
      ),
    },
  ],
};
