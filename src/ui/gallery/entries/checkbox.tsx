/** Checkbox — the three answers a box can hold, and the state that refuses all three (§5). */
import { Checkbox } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';
import { Labelled } from './labelled';

/** Radix's third value: neither checked nor clear. A token of the library, not copy. */
const MIXED = 'indeterminate' as const;

const label = (): string => gs('gallery.sample.checkbox.label');

/** One id per state cell, written rather than minted, so the sheet's markup never drifts. */
const labelId = (state: string): string => `gallery-labelled-checkbox-${state}`;

export const entry: GalleryEntry = {
  id: 'checkbox',
  covers: ['Checkbox'],
  states: [
    {
      name: 'unchecked',
      render: () => (
        <Labelled
          id={labelId('unchecked')}
          label={label()}
          control={(id) => <Checkbox aria-labelledby={id} />}
        />
      ),
    },
    {
      name: 'checked',
      render: () => (
        <Labelled
          id={labelId('checked')}
          label={label()}
          control={(id) => <Checkbox defaultChecked aria-labelledby={id} />}
        />
      ),
    },
    {
      name: 'indeterminate',
      render: () => (
        <Labelled
          id={labelId('indeterminate')}
          label={label()}
          control={(id) => <Checkbox checked={MIXED} aria-labelledby={id} />}
        />
      ),
    },
    {
      name: 'disabled',
      render: () => (
        <Labelled
          id={labelId('disabled')}
          label={label()}
          control={(id) => <Checkbox disabled aria-labelledby={id} />}
        />
      ),
    },
  ],
};
