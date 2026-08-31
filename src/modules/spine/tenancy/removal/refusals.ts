// The answer this module gives instead of removing a membership (ARCH-03, B-21: a refusal is an
// answer, not a fault). It travels as the settled core marker — an Error carrying a string
// `refusalCode`, which `core/faults/refusal-marker.ts` is the one reader of — and the marker is put
// on by the tenancy module's own constructor (`../refusals`) rather than assembled a second time
// here: a mechanism has one home, and a copy of one is a defect however short it is (ARCH-02,
// B-17). The code is read off the closed register in this file, so the refusal this module names
// and the registry entry it names cannot come to disagree (R-SPINE-062, Q-07). The message below is
// operator detail: what a person reads is the registered entry, rendered by the one renderer.
import { refusalOf } from "../../../../core/errors";
import { refusal } from "../refusals";

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
  return refusal(refusalOf("MEMBER_HAS_ACTS").code, "the acting tenant's log names this membership, so it was not removed", detail);
}
