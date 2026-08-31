// The answers this module gives instead of moving a role (ARCH-03, B-21: a refusal is an answer,
// not a fault). Each travels as the settled core marker — an Error carrying a string `refusalCode`,
// which `core/faults/refusal-marker.ts` is the one reader of — and the code itself is read off the
// closed register in `core/errors` rather than re-spelled here, so a seam and its registry entry
// cannot come to disagree (R-SPINE-062, ARCH-02, Q-07). The messages below are operator detail:
// what a person reads is the registered entry, rendered by the one renderer.
import { refusalOf, type RefusalCode } from "../../../core/errors";

/** An Error marked with a registered code and the facts the operator needs beside it. */
function refusal<D extends object>(code: RefusalCode, message: string, detail: D): Error & D {
  return Object.assign(new Error(message), { refusalCode: refusalOf(code).code }, detail);
}

/**
 * R-SPINE-006's two-sided guard, refusing: the actor does not hold a role that carries this move, or
 * the person they named outranks them. Both sides are one answer on purpose — an answer that said
 * which of the two it was would tell a caller who outranks whom in a workspace they may not read.
 */
export function workspacePermissionNotHeld(detail: { readonly subjectUserId?: string }): Error {
  return refusal("WORKSPACE_PERMISSION_NOT_HELD", "the acting membership does not carry this move over the membership it named", detail);
}

/** R-SPINE-006: leaving is not a workspace-administration gesture, so removal never names oneself. */
export function selfRemovalNotAllowed(): Error {
  return refusal("SELF_REMOVAL_NOT_ALLOWED", "a member cannot remove their own membership from a workspace", {});
}

/** R-SPINE-006's last-OWNER protection, refused at the seam rather than hidden by a screen. */
export function workspaceWouldHaveNoOwner(): Error {
  return refusal("WORKSPACE_WOULD_HAVE_NO_OWNER", "the workspace's last owning membership would be left without an owner", {});
}

/**
 * R-SPINE-006's origin verification: the request stated a page origin this deployment does not
 * serve, so the cookie it carried was presented by somebody else's page.
 */
export function originNotVerified(statedOrigin: string): Error {
  return refusal("ORIGIN_NOT_VERIFIED", "the request stated an origin this deployment does not answer at", { statedOrigin });
}
