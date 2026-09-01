/**
 * R-UI-050's seven states, and the shape a screen declares them in. The clause is the specification
 * of this tuple — the names are the law's own, in the law's own order — and everything else in this
 * module is derived from it, so no second spelling of the seven exists to drift (B-17).
 *
 * `src/ui/shell/states.ts` declares the same seven for the shell's screens in a different register:
 * that matrix says *whether* a state is rendered, delegated or impossible and names the module, and
 * is prose a reviewer reads. This one holds the state itself as a mountable node, so the completeness
 * check is a mount rather than a reading (R-UI-050, Q-14). Two questions, two homes.
 */
import type { ReactNode } from "react";

/** R-UI-050's seven, in the clause's own order. */
export const STATE_NAMES = ["loading", "empty", "error", "refusal", "partial", "offline", "permission-denied"] as const;

/** One of the seven. The union is the tuple's, so a name exists in exactly one place. */
export type ScreenStateName = (typeof STATE_NAMES)[number];

/** One declared state: the UI it puts on screen, built fresh on every mount. */
export interface ScreenState {
  readonly render: () => ReactNode;
}

/**
 * What one screen declares. Total over the seven by type — a screen cannot omit a state and still
 * compile, which is R-UI-050's "a missing state is a failing test, never a review note" moved one
 * step earlier still, to the compiler.
 */
export type ScreenDeclaration = Readonly<Record<ScreenStateName, ScreenState>>;

/** Every screen's declaration, keyed by the route key `routesOnDisk()` answers. */
export type ScreenStatesMatrix = Readonly<Record<string, ScreenDeclaration>>;

/** Code point order, never a locale's — `localeCompare` is banned tree-wide (no-raw-intl). */
export const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The identifier a state's rendered root is found by — one testid for all seven (R-UI-050). */
export const SCREEN_STATE_TESTID = "screen-state";
