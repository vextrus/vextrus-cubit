/**
 * A control and the words that name it, side by side (§1).
 *
 * The id is the caller's and is written out of the entry id and the state name, never `useId`'s:
 * a state cell is drawn once per entry on the sheet, so `gallery-labelled-<entry>-<state>` is
 * already unique page-wide and no duplicate id reaches the accessibility tree (R-UI-012). React's
 * client `useId` counts from a module global, which makes two renders of the same sheet produce
 * different markup — determinism is the stronger claim, and it costs the caller one string.
 */
import type { ReactElement, ReactNode } from 'react';

export interface LabelledProps {
  /** The id the label carries and the control points at; unique across the sheet. */
  readonly id: string;
  /** The words, from the entry string table. */
  readonly label: string;
  /** The control, given the id its label carries so it can point at it. */
  readonly control: (id: string) => ReactNode;
}

export function Labelled({ id, label, control }: LabelledProps): ReactElement {
  return (
    <span className="datum-gallery-labelled">
      {control(id)}
      <span id={id} className="datum-gallery-labelled-text">
        {label}
      </span>
    </span>
  );
}
