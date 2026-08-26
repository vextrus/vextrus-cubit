// ASSIGN_PARTICIPANT_ROLE (L-ACT-03: "assignment is itself an act"), rendered as L-ACT-02's pair.
// The Consequence names the subject and the roles it would hold before and after, so the digest the
// actor carries binds the very state a second assignment would move.
import { participantRoles, participants, type TenantTx } from "../db";
import type { Consequence } from "./consequence";
import { isRole, type Role } from "./law";
import { rolesGranted } from "./participation";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act's input: who is given which role on which project. */
export type AssignParticipantRoleInput = {
  readonly type: "ASSIGN_PARTICIPANT_ROLE";
  readonly projectId: string;
  readonly subjectUserId: string;
  readonly role: Role;
};

/** A role the closed enum does not hold bundles nothing, so it is not a grant anybody can make. */
function grantedRole(input: AssignParticipantRoleInput): Role {
  if (!isRole(input.role)) {
    throw new Error(`"${String(input.role)}" is not a role — roles are the closed set a human picks from (L-ACT-03)`);
  }
  return input.role;
}

export const assignParticipantRole: ActRendering<AssignParticipantRoleInput> = {
  async preview(ctx: ActorCtx, input: AssignParticipantRoleInput, tx: TenantTx): Promise<Consequence> {
    const role = grantedRole(input);
    const before = await rolesGranted(tx, input.projectId, input.subjectUserId);
    const after = [...new Set([...before, role])].sort();
    return {
      actType: "ASSIGN_PARTICIPANT_ROLE",
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      subjects: [{ subjectId: input.subjectUserId, before, after }],
    };
  },

  async commit(ctx: ActorCtx, input: AssignParticipantRoleInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    // L-ACT-03: "Participants attach to (project, user), append-only, mandatory ... assignment is
    // itself an act." Giving a person a role on a project is what attaches them to it, so the
    // attachment lands here, in the act's own transaction. The grant's composite FK to `participants`
    // is then the backstop the law calls it — a belt behind this write, not the thing a first
    // assignment trips over. Nothing is rewritten: a person already attached stays attached, at the
    // moment they first were, which is what an append-only participation means.
    await tx
      .insert(participants)
      .values({ tenantId: ctx.tenantId, projectId: input.projectId, userId: input.subjectUserId })
      .onConflictDoNothing();

    await tx.insert(participantRoles).values({
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      userId: input.subjectUserId,
      role: grantedRole(input),
      actId: act.actId,
    });
  },
};
