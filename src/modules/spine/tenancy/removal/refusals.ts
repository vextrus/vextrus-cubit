// The answer this module gives instead of removing a membership (ARCH-03, B-21: a refusal is an
// answer, not a fault). It travels as the settled core marker — an Error carrying a string
// `refusalCode`, which `core/faults/refusal-marker.ts` is the one reader of — and the code is read
// off the closed register rather than re-spelled beside it, so the seam and its registry entry
// cannot come to disagree (R-SPINE-062, ARCH-02, Q-07). The message below is operator detail: what
// a person reads is the registered entry, rendered by the one renderer.
//
// The marker itself is put on at this module's own edge, the way every module that answers a
// refusal puts it on at theirs (`core/acts/refusals.ts`, `core/format.ts`, `../refusals`): what
// ARCH-02 homes once is the marker's READER, and that home is `core/faults/refusal-marker.ts` —
// the shape a constructor hands it is the seam's published contract, not a mechanism this module
// would be re-deriving. Reaching into the parent module's private constructor instead would widen
// a file this increment does not own, so that a submodule could mint markers ad hoc.
import { refusalOf } from "../../../../core/errors";

/** What the coupling refused over: whose membership, and the acts of theirs the log holds. */
export interface ActsHeld {
  readonly subjectUserId: string;
  readonly actIds: readonly string[];
}

/**
 * R-SPINE-003's removal coupling, refusing: the log of the acting tenant names this membership, so
 * removing it would leave those records without the member they belong to (SEAM-ACT).
 */
export function memberHasActs(detail: ActsHeld): Error & ActsHeld {
  return Object.assign(new Error("the acting tenant's log names this membership, so it was not removed"), { refusalCode: refusalOf("MEMBER_HAS_ACTS").code }, detail);
}
