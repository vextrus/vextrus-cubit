/**
 * Select — the trigger, its value and the list behind it (§5).
 *
 * Drawn closed. An open listbox is portalled over the page and would cover the rest of the
 * sheet, so the sub-parts are wired and the visual-baseline increment scripts the open
 * (Design Decision, interpretation 2).
 */
import type { ReactElement } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The option values: the field's own vocabulary, not words anybody reads. */
const WALL = 'wall';
const COLUMN = 'column';
const BEAM = 'beam';
const SLAB = 'slab';

const options = (): readonly { readonly value: string; readonly label: string }[] => [
  { value: WALL, label: gs('gallery.sample.select.wall') },
  { value: COLUMN, label: gs('gallery.sample.select.column') },
  { value: BEAM, label: gs('gallery.sample.select.beam') },
  { value: SLAB, label: gs('gallery.sample.select.slab') },
];

interface SampleProps {
  readonly value?: string;
  readonly chosen?: string;
  readonly disabled?: boolean;
}

function Sample({ value, chosen, disabled }: SampleProps): ReactElement {
  return (
    <Select defaultValue={value} disabled={disabled}>
      <SelectTrigger aria-label={gs('gallery.entry.select')}>
        <SelectValue placeholder={gs('gallery.sample.select.placeholder')}>{chosen}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options().map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const entry: GalleryEntry = {
  id: 'select',
  covers: ['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'],
  states: [
    { name: 'placeholder', render: () => <Sample /> },
    {
      name: 'selected',
      render: () => <Sample value={COLUMN} chosen={gs('gallery.sample.select.column')} />,
    },
    { name: 'disabled', render: () => <Sample disabled /> },
  ],
};
