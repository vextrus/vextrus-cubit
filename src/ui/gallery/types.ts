/**
 * The gallery's data model (R-UI-011).
 *
 * An entry is a component's page in the drawing register: which barrel exports it accounts
 * for, and the states it draws. The names it covers are carried as data rather than written
 * into a test, so `coverageReport` can compare them with a surface derived from the barrels at
 * run time — a list of components written down anywhere is a list that goes quietly wrong on
 * the first increment that lawfully adds a primitive (the lanes-armed arbitration).
 */
import type { ReactNode } from 'react';

/** One drawn state of one component: the name that ends its test id, and what it paints. */
export interface GalleryEntryState {
  /** The `<state>` segment of `gallery-entry-<component>-<state>`, kebab-case. */
  readonly name: string;
  /** The sample, built fresh per render so no entry holds mounted state between screens. */
  readonly render: () => ReactNode;
}

/** One component's entry — the module at `src/ui/gallery/entries/<id>.tsx` exports one. */
export interface GalleryEntry {
  /** The kebab-case root component name: `button`, `data-table`. */
  readonly id: string;
  /** The barrel export names this entry accounts for: the root, plus its sub-parts. */
  readonly covers: readonly string[];
  readonly states: readonly GalleryEntryState[];
}

/**
 * The seven R-UI-050 states of the gallery screen itself, forced through `?state=`
 * (Design Decision §2). Anything else renders the live gallery.
 */
export type ScreenStateName =
  | 'loading'
  | 'empty'
  | 'error'
  | 'refusal'
  | 'partial'
  | 'offline'
  | 'permission-denied';
