/** RadioGroup and Radio — one choice out of two, the first one taken (§5). */
import type { ReactElement } from 'react';
import { Radio, RadioGroup } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';
import { Labelled } from './labelled';

/** The option values: the group's own vocabulary, not words anybody reads. */
const COMFORTABLE = 'comfortable';
const COMPACT = 'compact';

/** The state names of §5's row, so the ids below are the cells' own and read as such. */
const DEFAULT_STATE = 'default';
const DISABLED_STATE = 'disabled';

/**
 * One id per option per state cell, written rather than minted, so the sheet's markup never
 * drifts between two renders of it.
 */
const labelId = (state: string, option: string): string =>
  `gallery-labelled-radio-group-${state}-${option}`;

function Sample({ state, disabled }: { readonly state: string; readonly disabled?: boolean }): ReactElement {
  return (
    <RadioGroup
      defaultValue={COMFORTABLE}
      disabled={disabled}
      aria-label={gs('gallery.entry.radio-group')}
    >
      <Labelled
        id={labelId(state, COMFORTABLE)}
        label={gs('gallery.sample.radio-group.comfortable')}
        control={(id) => <Radio value={COMFORTABLE} aria-labelledby={id} />}
      />
      <Labelled
        id={labelId(state, COMPACT)}
        label={gs('gallery.sample.radio-group.compact')}
        control={(id) => <Radio value={COMPACT} aria-labelledby={id} />}
      />
    </RadioGroup>
  );
}

export const entry: GalleryEntry = {
  id: 'radio-group',
  covers: ['Radio', 'RadioGroup'],
  states: [
    { name: DEFAULT_STATE, render: () => <Sample state={DEFAULT_STATE} /> },
    { name: DISABLED_STATE, render: () => <Sample state={DISABLED_STATE} disabled /> },
  ],
};
