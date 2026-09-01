// The answer an invitation gives instead of being spent (ARCH-03, B-21: a refusal is an answer, not
// a fault). It travels as the settled core marker, and the code is read off the closed register in
// `core/errors` rather than re-spelled — the same discipline the module's other refusals keep
// (R-SPINE-062, ARCH-02, Q-07).
import { refusalOf } from "../../../../core/errors";

/**
 * R-SPINE-003's ACCEPT flow refusing: the token names no invitation this deployment can spend.
 *
 * Unknown, already accepted, withdrawn and addressed to somebody else are ONE answer on purpose. An
 * answer that told them apart would tell whoever holds a token which of the four it is — and a
 * stranger probing addresses would learn whether an address was ever invited to a workspace they may
 * not read. The detail below is operator detail; what a person reads is the registered entry.
 */
export function invitationNotClaimable(detail: { readonly reason: string }): Error {
  return Object.assign(new Error("the invitation this token names cannot be claimed by the account presenting it"), {
    refusalCode: refusalOf("INVITATION_NOT_CLAIMABLE").code,
    ...detail,
  });
}
