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

interface SampleProps {
  readonly disabled?: boolean;
  readonly invalid?: boolean;
}

function Sample({ disabled, invalid }: SampleProps): ReactElement {
  const [value, setValue] = useState(VALUE);
  return (
    <NumberInput
      value={value}
      onValueChange={setValue}
      unit={UNIT}
      disabled={disabled}
      aria-invalid={invalid}
      aria-label={gs('gallery.sample.number-input.name')}
    />
  );
}

export const entry: GalleryEntry = {
  id: 'number-input',
  covers: ['NumberInput'],
  states: [
    { name: 'default', render: () => <Sample /> },
    { name: 'disabled', render: () => <Sample disabled /> },
    { name: 'invalid', render: () => <Sample invalid /> },
  ],
};
