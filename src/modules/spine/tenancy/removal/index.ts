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
import { forTenant } from "../../../../core/db";
import { removeMember as removeMembership, type MemberRef, type MemberRemoved } from "../roles/assign";
import type { TenancyActor } from "../scope";
import { memberHasActs } from "./refusals";

export { memberHasActs, type ActsHeld } from "./refusals";

/**
 * Take one membership away, coupled to the act log (R-SPINE-003). The log is asked first, because
 * what it says is a fact about the membership rather than about the person asking: a member it names
 * is not removable by anybody, so the answer does not depend on which of the role law's guards the
 * caller would have met.
 */
export async function removeMember(actor: TenancyActor, request: MemberRef): Promise<MemberRemoved> {
  const held = await forTenant(actor).transaction((tx) => actsHeldBy(tx, request.subjectUserId));
  if (held.length > 0) throw memberHasActs({ subjectUserId: request.subjectUserId, actIds: held });

  return removeMembership(actor, request);
}
