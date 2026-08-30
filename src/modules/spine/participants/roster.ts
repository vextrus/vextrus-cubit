// Who holds which role on a project right now. The roster is the effective reading — grants minus
// withdrawals — because a role that has been taken back is on the record but not in force
// (R-SPINE-011); the subtraction itself is the act seam's, called here rather than repeated (B-17).
import { effectiveGrants, ROLES } from "../../../core/acts";
import { asc, eq, forTenant, participants } from "../../../core/db";
import { identitiesOf, identityOf } from "./directory";
import { requireRoleHistoryAccess } from "./guard";
import type { ProjectRef } from "./history";
import type { MemberIdentity, ParticipantsCtx } from "./scope";

/** One person on a project, and the roles they hold there at this moment. */
export interface ProjectParticipant {
  readonly member: MemberIdentity;
  readonly roles: readonly string[];
}

/**
 * The project's participants, oldest attachment first, each with the roles in force for them. The
 * roles are ordered by the enum rather than alphabetically: L-ACT-03 declares them in an order, and
 * a person reading two rosters side by side reads the same role in the same place.
 */
export async function projectParticipants(ctx: ParticipantsCtx, ref: ProjectRef): Promise<readonly ProjectParticipant[]> {
  await requireRoleHistoryAccess(ctx, ref.projectId);

  return forTenant(ctx).transaction(async (tx) => {
    const attached = await tx
      .select({ userId: participants.userId })
      .from(participants)
      .where(eq(participants.projectId, ref.projectId))
      .orderBy(asc(participants.joinedAt), asc(participants.userId));

    const known = await identitiesOf(attached.map((row) => row.userId));
    const roster: ProjectParticipant[] = [];
    for (const row of attached) {
      const held = (await effectiveGrants(tx, ref.projectId, row.userId)).map((grant) => grant.role);
      roster.push({ member: identityOf(known, row.userId), roles: inDeclaredOrder(held) });
    }
    return roster;
  });
}

/**
 * The roles a person holds, in the order L-ACT-03 declares them. A role the enum does not declare
 * keeps its place after the declared ones rather than vanishing: the store holds what it holds, and
 * a roster that silently dropped a row would be a roster nobody could reconcile against the ledger.
 */
function inDeclaredOrder(held: readonly string[]): readonly string[] {
  const declared = ROLES.filter((role) => held.includes(role));
  const rest = held.filter((role) => !(ROLES as readonly string[]).includes(role)).sort();
  return [...declared, ...rest];
}
