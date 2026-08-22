/** UnitBadge — the closed unit enum, all five of it in one row (§5). */
import { UnitBadge } from '../../data';
import type { Unit } from '../../../core/format';
import type { GalleryEntry } from '../types';

/** The five L-FMT-02 fixes; each renders through `formatUnit`, never a spelling. */
const UNITS: readonly Unit[] = ['m', 'm2', 'm3', 'kg', 'nos'];

export const entry: GalleryEntry = {
  id: 'unit-badge',
  covers: ['UnitBadge'],
  states: [
    {
      name: 'default',
      render: () => (
        <span className="datum-gallery-row">
          {UNITS.map((unit) => (
            <UnitBadge key={unit} unit={unit} />
          ))}
        </span>
      ),
    },
  ],
};
