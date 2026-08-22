/**
 * Combobox — a typed query answered from a local list (§5).
 *
 * `loadOptions` is async by contract, so the sample keeps the contract and resolves from an
 * array in this file: no network and no timer, which is what §4 means by deterministic. The
 * layer names are identifiers on a drawing, not copy.
 */
import type { ComboboxOption } from '../../primitives';
import { Combobox } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

const LAYERS: readonly ComboboxOption[] = Object.freeze([
  { value: 'S-COL', label: 'S-COL' },
  { value: 'S-BEAM', label: 'S-BEAM' },
  { value: 'S-SLAB', label: 'S-SLAB' },
]);

const loadLayers = (query: string): Promise<readonly ComboboxOption[]> =>
  Promise.resolve(LAYERS.filter((option) => option.label.includes(query.toUpperCase())));

export const entry: GalleryEntry = {
  id: 'combobox',
  covers: ['Combobox'],
  states: [
    {
      name: 'default',
      render: () => (
        <Combobox
          loadOptions={loadLayers}
          placeholder={gs('gallery.sample.combobox.placeholder')}
          aria-label={gs('gallery.entry.combobox')}
        />
      ),
    },
  ],
};
