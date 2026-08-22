/** RadioGroup and Radio — one choice out of two, the first one taken (§5). */
import type { ReactElement } from 'react';
import { Radio, RadioGroup } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';
import { Labelled } from './labelled';

/** The option values: the group's own vocabulary, not words anybody reads. */
const COMFORTABLE = 'comfortable';
const COMPACT = 'compact';

function Sample({ disabled }: { readonly disabled?: boolean }): ReactElement {
  return (
    <RadioGroup
      defaultValue={COMFORTABLE}
      disabled={disabled}
      aria-label={gs('gallery.entry.radio-group')}
    >
      <Labelled
        label={gs('gallery.sample.radio-group.comfortable')}
        control={(id) => <Radio value={COMFORTABLE} aria-labelledby={id} />}
      />
      <Labelled
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
    { name: 'default', render: () => <Sample /> },
    { name: 'disabled', render: () => <Sample disabled /> },
  ],
};
