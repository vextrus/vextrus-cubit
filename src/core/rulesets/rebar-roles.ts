// Which bar roles CONFINE rather than run — one home for the split every rebar reader makes (B-17).
//
// A link, a tie, a spiral takes its length from the member's own section: its perimeter and its
// hooks. Every other role runs along the member and takes its length from the run, its laps and its
// anchorage. A member's mass splits on this line (`massesOf`), and a schedule that cannot state a
// run's laps can still state its links (s-bbs I-567).
//
// It stands beside the methods rather than in one: a method file is versioned code whose bytes are
// recorded (L-MEA-01), and a roster two readers share is not a method.
import type { BarRole } from "./methods/rebar/synthesis";

/** The roles that confine rather than run. */
export const LINK_ROLES: readonly BarRole[] = Object.freeze(["TIE", "STIRRUP", "SPIRAL"] as const);

/** Does a bar of this role confine (a link) rather than run along its member? */
export function isLinkRole(role: string): boolean {
  return (LINK_ROLES as readonly string[]).includes(role);
}
