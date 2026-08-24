/**
 * `ASSIGN_PARTICIPANT_ROLE` — the one act M0 can perform (L-ACT-02, L-ACT-03, R-SPINE-011).
 *
 * L-ACT-02: "Every act type is a pair `preview(input) → Consequence` and
 * `commit(input, consequenceDigest)`; the Consequence is a typed value computed by the
 * committing code path." The pair is below, and both halves compute the Consequence the same
 * way — the preview to show it, the commit to check that state still produces it.
 *
 * The Consequence answers the question the human is about to confirm: this person, on this
 * project, holds *this* now (or nothing yet), would hold *that*, and the project would be left
 * with this many principals. That last member is not decoration: L-ACT-03's "the last PRINCIPAL
 * cannot be removed" is a fact about the state after the act, so the number the dialog shows and
 * the number the guard reads are the same number.
 */
import { REFUSALS } from '../errors';
import { ActSeamRefusal } from './refusal';
import { currentRoles, recordGrant } from './participation';
import type { ActCtx } from './participation';
import { ACT_TYPE, ROLE, isRole } from './vocabulary';
import type { Role } from './vocabulary';

/** L-ACT-02's typed value for this act. Every member is state the commit must still find true. */
export interface AssignParticipantRoleConsequence {
  readonly act: 'acts.assignParticipantRole';
  readonly tenantId: string;
  readonly projectId: string;
  readonly userId: string;
  /** What they hold now — null when they are not yet a participant at all. */
  readonly currentRole: Role | null;
  readonly proposedRole: Role;
  /** How many principals the project would have once this act is performed (L-ACT-03). */
  readonly principalsAfter: number;
}

/**
 * The act's input.
 *
 * The proposed role reads under either name. The Increment Spec fixes the Consequence's member
 * names and leaves the input's to the seam, so callers written against either spelling are
 * answered rather than refused for a difference that carries no meaning.
 */
export interface AssignParticipantRoleInput {
  readonly projectId: string;
  readonly userId: string;
  readonly role?: string;
  readonly proposedRole?: string;
}

interface Read {
  readonly projectId: string;
  readonly userId: string;
  readonly proposedRole: Role;
}

function readInput(input: unknown): Read {
  const given = (input ?? {}) as AssignParticipantRoleInput;
  const proposed: unknown = given.proposedRole ?? given.role;
  if (typeof given.projectId !== 'string' || given.projectId === '') {
    throw new TypeError('an assignment names the project it is on');
  }
  if (typeof given.userId !== 'string' || given.userId === '') {
    throw new TypeError('an assignment names the person it is about');
  }
  if (!isRole(proposed)) {
    throw new TypeError(`${JSON.stringify(proposed)} is not one of the roles a human may pick`);
  }
  return { projectId: given.projectId, userId: given.userId, proposedRole: proposed };
}

/**
 * What the project's grants would be after this act, and what they are now.
 *
 * The count is taken over everybody's *current* role with the target's replaced, which is what
 * makes a demotion and a promotion the same arithmetic — and what makes assigning somebody the
 * role they already hold leave the count where it was.
 */
async function consequenceOf(
  ctx: ActCtx,
  read: Read,
): Promise<AssignParticipantRoleConsequence> {
  const held = await currentRoles(ctx, read.projectId);
  const after = new Map(held);
  after.set(read.userId, read.proposedRole);
  let principalsAfter = 0;
  for (const role of after.values()) {
    if (role === ROLE.PRINCIPAL) principalsAfter += 1;
  }
  return {
    act: 'acts.assignParticipantRole',
    tenantId: ctx.tenantId,
    projectId: read.projectId,
    userId: read.userId,
    currentRole: held.get(read.userId) ?? null,
    proposedRole: read.proposedRole,
    principalsAfter,
  };
}

/**
 * L-ACT-03: "the last PRINCIPAL cannot be removed (`PROJECT_WOULD_HAVE_NO_PRINCIPAL`)."
 *
 * Checked on the *preview*, and so on the commit that recomputes it: an act that cannot be
 * performed is not one a human should be shown the consequences of and invited to confirm. M0
 * has no act that removes a participant outright, so a demotion is the only way a project can
 * lose its last principal.
 */
function refuseIfPrincipalless(consequence: AssignParticipantRoleConsequence): void {
  if (consequence.principalsAfter > 0) return;
  throw new ActSeamRefusal(REFUSALS.PROJECT_WOULD_HAVE_NO_PRINCIPAL.code, {
    actType: ACT_TYPE.ASSIGN_PARTICIPANT_ROLE,
  });
}

/** The pair L-ACT-02 makes every act type: what it would do, and doing it. */
export const assignParticipantRole = {
  async preview(ctx: ActCtx, input: unknown): Promise<AssignParticipantRoleConsequence> {
    const consequence = await consequenceOf(ctx, readInput(input));
    refuseIfPrincipalless(consequence);
    return consequence;
  },

  /**
   * The write, once the seam has checked the permission, recomputed the Consequence and found
   * the caller's digest to be the one this state produces. `recordGrant` is one statement, so
   * the act row and the grant it made commit together or not at all (L-ACT-01).
   */
  async commit(
    ctx: ActCtx,
    consequence: AssignParticipantRoleConsequence,
  ): Promise<{ actId: string }> {
    return recordGrant(ctx, ACT_TYPE.ASSIGN_PARTICIPANT_ROLE, {
      projectId: consequence.projectId,
      userId: consequence.userId,
      role: consequence.proposedRole,
    });
  },
};
