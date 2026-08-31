// R-SPINE-003: "remove member (refused while the member holds acts on open campaigns:
// MEMBER_HAS_ACTS)". This is that coupling, and the only place it lives (ARCH-02).
//
// SEAM-ACT puts tenant administration outside the act log's writ "under their own guards plus the
// MEMBER_HAS_ACTS coupling": removal writes no act row, and in exchange it may not take away a
// membership the log names — a record whose author is no longer anybody is not a record. What the
// log says is asked of the act seam's own read (`actsHeldBy`), through the acting tenant's handle;
// this module holds no view of the log beyond that answer, and no handle of its own beyond the one
// the seam's read is spoken through (SEAM-TENANT).
//
// Once the log has nothing to say, the removal itself is R-SPINE-006's, unchanged: the two-sided
// role law in ../roles/assign decides who may remove whom, and it is delegated to rather than
// re-stated here (B-17).
import { actsHeldBy } from "../../../../core/acts";
import { forTenant, isUuid } from "../../../../core/db";
import { removeMember as removeMembership, type MemberRef, type MemberRemoved } from "../roles/assign";
import type { TenancyActor } from "../scope";
import { memberHasActs } from "./refusals";

export { memberHasActs, type ActsHeld } from "./refusals";

/**
 * Take one membership away, coupled to the act log (R-SPINE-003). The log is asked first, because
 * what it says is a fact about the membership rather than about the person asking: a member it names
 * is not removable by anybody, so the answer does not depend on which of the role law's guards the
 * caller would have met.
 *
 * An actor whose tenant is not a workspace the policies can read names no log to ask — the same
 * answer `actsHeldBy` gives for a person the log's `uuid` columns could not carry, and the same
 * shape `scopedTenantId` takes at the handle. Asking anyway would take a handle that refuses to be
 * taken, and an actor holding no membership (the transport answers such a session `""`) would be
 * given a bare Error where the role law it is on its way to holds a registered refusal for exactly
 * that person: a caller whose request was judged is owed an answer, not a fault id (ARCH-03, B-21).
 */
export async function removeMember(actor: TenancyActor, request: MemberRef): Promise<MemberRemoved> {
  if (isUuid(actor.tenantId)) {
    const held = await forTenant(actor).transaction((tx) => actsHeldBy(tx, request.subjectUserId));
    if (held.length > 0) throw memberHasActs({ subjectUserId: request.subjectUserId, actIds: held });
  }

  return removeMembership(actor, request);
}
