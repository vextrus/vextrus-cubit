/**
 * NumberInput — a quantity as a decimal string, its unit written beside it (§5).
 *
 * The value is held in state so the field on the sheet is the live one: the primitive's whole
 * contract is what it does between a keystroke and a blur, and a fixed `value` with no handler
 * would draw a picture of it instead. `1234567.89` is a string, never a float (B-07).
 */
'use client';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { formatUnit } from '../../../core/format';
import { NumberInput } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The sample quantity, as the document carries it: a decimal string. */
const VALUE = '1234567.89';

/** The unit through the format seam, never a caller's spelling (L-FMT-02). */
const UNIT = formatUnit('m2');

/** The state names of §5's row, so each cell's suffix id is written from the cell itself. */
const DEFAULT_STATE = 'default';
const DISABLED_STATE = 'disabled';
const INVALID_STATE = 'invalid';

/**
 * The unit is written beside the field by the gallery rather than passed as `unit`.
 *
 * `NumberInput` mints its suffix id with `useId`, which counts from a module global: two renders
 * of the same sheet would carry different ids, and the sheet's markup has to be identical across
 * renders. `src/ui/primitives/**` is out of this increment's scope, so the cell hands the field a
 * `aria-describedby` of its own — which flows through untouched while `unit` is undefined — and
 * draws the suffix under that id itself. The accessible description and §5's "unit written beside
 * it" both survive; only the id stops being React's.
 *
 * The primitive is left alone inside its own box: the cell is a plain row that puts the unit next
 * to it, and never restyles `.datum-number-input`. What the sheet shows of this component is what
 * the component ships — including the invalid border, which primitives.css draws (R-UI-011).
 */
const suffixId = (state: string): string => `gallery-number-input-${state}-unit`;

interface SampleProps {
  readonly state: string;
  readonly disabled?: boolean;
  readonly invalid?: boolean;
}

function Sample({ state, disabled, invalid }: SampleProps): ReactElement {
  const [value, setValue] = useState(VALUE);
  const unitId = suffixId(state);
  return (
    <div className="datum-gallery-number-input">
      <NumberInput
        value={value}
        onValueChange={setValue}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={unitId}
        aria-label={gs('gallery.sample.number-input.name')}
      />
      <span id={unitId} data-testid="number-input-suffix" className="datum-number-suffix">
        {UNIT}
      </span>
    </div>
  );
}

export const entry: GalleryEntry = {
  id: 'number-input',
  covers: ['NumberInput'],
  states: [
    { name: DEFAULT_STATE, render: () => <Sample state={DEFAULT_STATE} /> },
    { name: DISABLED_STATE, render: () => <Sample state={DISABLED_STATE} disabled /> },
    { name: INVALID_STATE, render: () => <Sample state={INVALID_STATE} invalid /> },
  ],
};
