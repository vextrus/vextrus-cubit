/**
 * A control and the words that name it, side by side (§1).
 *
 * The id is `useId`'s rather than a constant: the same state cell is drawn once per entry and
 * the sheet holds forty of them, so a hand-written id would be a duplicate id on the page —
 * which is an accessibility finding before it is a naming one (R-UI-012).
 */
'use client';
import type { ReactElement, ReactNode } from 'react';
import { useId } from 'react';

export interface LabelledProps {
  /** The words, from the entry string table. */
  readonly label: string;
  /** The control, given the id its label carries so it can point at it. */
  readonly control: (id: string) => ReactNode;
}

export function Labelled({ label, control }: LabelledProps): ReactElement {
  const id = useId();
  return (
    <span className="datum-gallery-labelled">
      {control(id)}
      <span id={id} className="datum-gallery-labelled-text">
        {label}
      </span>
    </span>
  );
}
