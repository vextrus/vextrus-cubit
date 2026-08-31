// R-SPINE-006: "Authorization is two-sided and server-held: role assignment guards both the role
// being granted and the role being stripped (an ADMIN can neither demote nor remove an OWNER);
// self-removal and last-OWNER protection are server refusals, never UI hiding."
//
// This is where that law lives, once, for every transport and every screen (B-17, ARCH-02). It is
// asked of the store rather than of anything a caller sent: the actor's own role, the subject's own
// role and the workspace's own owner count are read here, so a caller who states a role, a rank or a
// membership is stating nothing the guard consults.
//
// The order the questions are asked in is itself part of the law, because each one has its own
// registered answer:
//   1. the actor must hold a membership that administers the workspace;
//   2. the subject must hold a membership of the same workspace;
//   3. the stripped side — nobody but an OWNER moves a member who stands as high as they do;
//   4. the granted side — nobody grants a rank above their own;
//   5. the workspace must be left with an owner;
//   6. and removal never names oneself.
// Permission comes before the last-OWNER protection so that an ADMIN reaching for the sole OWNER is
// told they may not, rather than being told about a workspace they may not administer; the
// protection comes before self-removal so that a sole OWNER leaving is answered by the fact that
// matters — the workspace would have no owner — while a co-owner leaving is answered by the fact
// that they may not let themselves out.
import { isUuid, type WorkspaceRole } from "../../../../core/db";
import { selfRemovalNotAllowed, workspacePermissionNotHeld, workspaceWouldHaveNoOwner } from "../refusals";
import type { TenancyActor } from "../scope";
import { mayAdminister, outranks, OWNING_ROLE, standsAtLeast } from "./rank";
import { dropMembership, membersHolding, roleHeld, writeRole } from "./store";

/** A role move, as a caller states it: whose membership, and which role it is to carry. */
export interface RoleAssignment {
  readonly subjectUserId: string;
  readonly role: WorkspaceRole;
}

/** A removal, as a caller states it: whose membership. */
export interface MemberRef {
  readonly subjectUserId: string;
}

/** What a move that landed answers with: the membership, as the store now holds it. */
export interface RoleMoved {
  readonly subjectUserId: string;
  readonly workspaceRole: WorkspaceRole;
}

/** What a removal that landed answers with. */
export interface MemberRemoved {
  readonly subjectUserId: string;
  readonly removed: true;
}

/** The two people a move is about, with the roles the store says they hold. */
interface Sides {
  readonly actorRole: WorkspaceRole;
  readonly subjectRole: WorkspaceRole;
  readonly isSelf: boolean;
}

/**
 * Steps 1 to 3, which every move shares. A subject id that is not a uuid names no membership — and
 * `memberships.user_id` is a `uuid`, so carrying it into a statement would raise 22P02, a driver
 * error with no refusal marker on it — so it is answered as the membership it does not name.
 */
async function sidesOf(actor: TenancyActor, subjectUserId: string): Promise<Sides> {
  const refused = (): Error => workspacePermissionNotHeld({ subjectUserId });

  const actorRole = await roleHeld(actor.tenantId, actor.userId);
  if (actorRole === null || !mayAdminister(actorRole)) throw refused();

  if (!isUuid(subjectUserId)) throw refused();
  const subjectRole = await roleHeld(actor.tenantId, subjectUserId);
  if (subjectRole === null) throw refused();

  // The stripped side: an ADMIN may move the members below them and nobody else, while an OWNER
  // moves anybody — including another OWNER, which is what makes a workspace transferable at all.
  const isSelf = subjectUserId === actor.userId;
  if (!isSelf && !standsAtLeast(actorRole, OWNING_ROLE) && standsAtLeast(subjectRole, actorRole)) throw refused();

  return { actorRole, subjectRole, isSelf };
}

/**
 * Grant or strip one membership's workspace role (R-SPINE-006). The write goes through the seam's
 * system handle with its reason recorded, and writes no act row: tenant administration sits outside
 * the act log's writ (SEAM-ACT).
 */
export async function assignWorkspaceRole(actor: TenancyActor, request: RoleAssignment): Promise<RoleMoved> {
  const { actorRole, subjectRole } = await sidesOf(actor, request.subjectUserId);

  // The granted side: nobody hands out a rank they do not hold themselves.
  if (outranks(request.role, actorRole)) throw workspacePermissionNotHeld({ subjectUserId: request.subjectUserId });

  if (subjectRole === OWNING_ROLE && request.role !== OWNING_ROLE && (await membersHolding(actor.tenantId, OWNING_ROLE)) === 1) {
    throw workspaceWouldHaveNoOwner();
  }

  const moved = await writeRole(actor, request.subjectUserId, request.role);
  return { subjectUserId: moved.userId, workspaceRole: moved.workspaceRole };
}

/**
 * Take one membership away (R-SPINE-003's "remove member", under R-SPINE-006's guards). The removal
 * is the seam's own write, under a recorded system reason, and it writes no act row for the reason
 * an assignment does not (SEAM-ACT).
 */
export async function removeMember(actor: TenancyActor, request: MemberRef): Promise<MemberRemoved> {
  const { subjectRole, isSelf } = await sidesOf(actor, request.subjectUserId);

  if (subjectRole === OWNING_ROLE && (await membersHolding(actor.tenantId, OWNING_ROLE)) === 1) throw workspaceWouldHaveNoOwner();
  if (isSelf) throw selfRemovalNotAllowed();

  const removed = await dropMembership(actor, request.subjectUserId);
  if (!removed) throw workspacePermissionNotHeld({ subjectUserId: request.subjectUserId });
  return { subjectUserId: request.subjectUserId, removed: true };
}
