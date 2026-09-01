/**
 * R-UI-050's matrix, made mechanical: every screen the app router holds declares all seven states in
 * one enumerable place, each one a node that mounts. The clause is explicit that the matrix is
 * checkable rather than aspirational — so what a screen owes is arithmetic here (`missingStates`),
 * not a review note, and a screen added without its declarations is a failing test (Q-14, B-19).
 *
 * The roster this is closed against is derived from the tree by `./route-scan`, which is node-only
 * and deliberately not re-exported here: a page that imports this module gets the declarations and
 * never a filesystem walk.
 */
import { STATE_NAMES, byCodePoint } from "./contract";
import type { ScreenStateName, ScreenStatesMatrix } from "./contract";
import { screenStates } from "./matrix";

export { STATE_NAMES } from "./contract";
export { screenStates } from "./matrix";
export type { ScreenDeclaration, ScreenState, ScreenStateName, ScreenStatesMatrix } from "./contract";

/**
 * What a roster of routes is owed and does not have: `"<route>/<state>"` for every state a screen
 * fails to declare, code-point sorted. A screen with no declaration at all owes all seven, which is
 * how a route added to the tree reports itself rather than passing unnoticed.
 *
 * A state present but not mountable is owed too: the declaration is the render, so an entry without
 * one has declared nothing.
 */
export function missingStates(routes: readonly string[], matrix: ScreenStatesMatrix = screenStates): string[] {
  const owed: string[] = [];
  for (const route of routes) {
    const declaration: Readonly<Partial<Record<ScreenStateName, unknown>>> | undefined = matrix[route];
    for (const state of STATE_NAMES) {
      const declared = declaration?.[state];
      const mountable = typeof declared === "object" && declared !== null && typeof (declared as { render?: unknown }).render === "function";
      if (!mountable) owed.push(`${route}/${state}`);
    }
  }
  return owed.sort(byCodePoint);
}
