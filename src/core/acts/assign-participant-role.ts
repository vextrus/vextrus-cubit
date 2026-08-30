// ASSIGN_PARTICIPANT_ROLE (L-ACT-03: "assignment is itself an act"), rendered as L-ACT-02's pair.
// The Consequence names the subject and the roles it would hold before and after, so the digest the
// actor carries binds the very state a second assignment would move.
//
// The act moves a role in one of two directions. R-SPINE-011 asks for both — roles are assigned by
// act, and the last PRINCIPAL is protected against removal, which is a removal path stated in law —
// and the act-type enum is closed, so the direction is a field of this one act rather than a second
// member of the enum. An input that names none grants, which is what every caller before the
// withdrawal direction existed meant by it.
import { isUuid, participantRoleWithdrawals, participantRoles, participants, type TenantTx } from "../db";
import type { Consequence } from "./consequence";
import { isRole, type Role } from "./law";
import { effectiveGrants, holdersOf } from "./participation";
import { projectWouldHaveNoPrincipal } from "./refusals";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** Which way the role moves. Absent means GRANT: the direction this act had before it had two. */
export type AssignDirection = "GRANT" | "WITHDRAW";

/** The role whose bundle L-ACT-03 makes ADMINISTER_PROJECT — and so the one the law protects. */
const PRINCIPAL: Role = "PRINCIPAL";

/** The act's input: who is given (or has taken back) which role on which project. */
export type AssignParticipantRoleInput = {
  readonly type: "ASSIGN_PARTICIPANT_ROLE";
  readonly projectId: string;
  readonly subjectUserId: string;
  readonly role: Role;
  readonly direction?: AssignDirection;
};

/** A role the closed enum does not hold bundles nothing, so it is not a grant anybody can make. */
function assignedRole(input: AssignParticipantRoleInput): Role {
  if (!isRole(input.role)) {
    throw new Error(`"${String(input.role)}" is not a role — roles are the closed set a human picks from (L-ACT-03)`);
  }
  return input.role;
}

/**
 * The subject the act moves a role for. The id arrives on the same wire the project id does — a URL
 * segment or a form field a caller writes freely — and every column it is compared against is a
 * `uuid`: a value that is not one makes postgres raise 22P02, a driver error carrying no refusal
 * marker, from inside the preview's own read. It is judged here, at the seam both transports and
 * both server actions come through (B-17), for the same reason the roster guard judges the project
 * id before its query: a string that names no user names nobody this act could move a role for.
 */
function assignedSubject(input: AssignParticipantRoleInput): string {
  if (typeof input.subjectUserId !== "string" || !isUuid(input.subjectUserId)) {
    throw new Error(`"${String(input.subjectUserId)}" is not a user id — ASSIGN_PARTICIPANT_ROLE names the person it moves a role for`);
  }
  return input.subjectUserId;
}

/** The direction the input names, or the one an input naming none has always meant. */
export function directionOf(input: AssignParticipantRoleInput): AssignDirection {
  const direction = input.direction ?? "GRANT";
  if (direction !== "GRANT" && direction !== "WITHDRAW") {
    throw new Error(`"${String(direction)}" is not a direction — ASSIGN_PARTICIPANT_ROLE moves a role one of two ways`);
  }
  return direction;
}

/**
 * L-ACT-03's load-bearing invariant, judged from the state the reading transaction holds: a project
 * holds at least one effective PRINCIPAL at every moment. It is checked as the Consequence is
 * computed — by the preview a person is shown AND by the recomputation the commit makes inside its
 * own locked transaction — so the protection never depends on which preview an actor happened to
 * run, and never on the carried digest agreeing with anything.
 */
async function requireAPrincipalWouldStand(input: AssignParticipantRoleInput, tx: TenantTx, role: Role): Promise<void> {
  if (role !== PRINCIPAL) return;
  const holders = await holdersOf(tx, input.projectId, PRINCIPAL);
  const remaining = holders.filter((userId) => userId !== input.subjectUserId);
  if (remaining.length === 0) throw projectWouldHaveNoPrincipal("ASSIGN_PARTICIPANT_ROLE", input.projectId, input.subjectUserId);
}

/** The roles the subject would hold once this act landed, in the order the digest is taken over. */
function after(before: readonly string[], role: Role, direction: AssignDirection): string[] {
  return direction === "GRANT" ? [...new Set([...before, role])].sort() : before.filter((held) => held !== role);
}

export const assignParticipantRole: ActRendering<AssignParticipantRoleInput> = {
  async preview(ctx: ActorCtx, input: AssignParticipantRoleInput, tx: TenantTx): Promise<Consequence> {
    const role = assignedRole(input);
    assignedSubject(input);
    const direction = directionOf(input);
    if (direction === "WITHDRAW") await requireAPrincipalWouldStand(input, tx, role);

    const before = (await effectiveGrants(tx, input.projectId, input.subjectUserId)).map((grant) => grant.role);
    return {
      actType: "ASSIGN_PARTICIPANT_ROLE",
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      // One subject moving between two role lists is exactly the SUBJECTS arm (L-ACT-02).
      rendering: "SUBJECTS",
      subjects: [{ subjectId: input.subjectUserId, before, after: after(before, role, direction) }],
    };
  },

  async commit(ctx: ActorCtx, input: AssignParticipantRoleInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const role = assignedRole(input);
    assignedSubject(input);
    if (directionOf(input) === "WITHDRAW") {
      // The grant the withdrawal countermands, read from the same transaction that judged the
      // Consequence: nothing here rewrites `participant_roles`, because the grant is a record of
      // what happened and a withdrawal is a second record of what happened next (L-ACT-03).
      const standing = (await effectiveGrants(tx, input.projectId, input.subjectUserId)).find((grant) => grant.role === role);
      if (standing === undefined) {
        throw new Error(`${input.subjectUserId} holds no standing ${role} on this project, so there is no grant to countermand — the Consequence this commit carried said otherwise`);
      }
      await tx.insert(participantRoleWithdrawals).values({
        tenantId: ctx.tenantId,
        grantId: standing.grantId,
        projectId: input.projectId,
        userId: input.subjectUserId,
        role,
        actId: act.actId,
      });
      return;
    }

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
      role,
      actId: act.actId,
    });
  },
};
