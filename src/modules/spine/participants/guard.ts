// L-ACT-03: "Role history is readable by the project's participants and tenant OWNER/ADMIN — one
// guard at the seam, used by every door; a read-path `PERMISSION_NOT_HELD` names the missing
// permission (it has no act type to name, and that is lawful)."
//
// This is that one guard. Every door of this module asks it first, so "who may see who holds which
// role" is answered in one place rather than once per transport (ARCH-02, B-17).
//
// The clause names two limbs, and both are read here: the project's own participants, and the
// workspace roles R-SPINE-003 gives a tenant — `memberships.workspace_role`, whose roster
// `WORKSPACE_ROLES` is the one home of (B-17). A workspace OWNER or ADMIN answers for the whole
// workspace, so they read a project's role history without standing on the project; a workspace
// MEMBER who does not participate is refused, which is what makes the first limb mean anything.
import { permissionNotHeld } from "../../../core/acts";
import { and, eq, forTenant, isUuid, memberships, participants, runAsSystem, type WorkspaceRole } from "../../../core/db";
import type { ParticipantsCtx } from "./scope";

/**
 * ADMINISTER_PROJECT is the permission L-ACT-03 makes PRINCIPAL-only, and a project's roster is what
 * it administers. The act type is null: a read moves nothing, so it has no act type to name, and the
 * clause says in as many words that this is lawful.
 */
const ROSTER_PERMISSION = "ADMINISTER_PROJECT" as const;

/**
 * Does this person stand on this project at all? The project id arrives from a URL segment or a
 * wire field a caller can write anything into, and `participants.project_id` is a `uuid`: a value
 * that is not one makes postgres raise 22P02, a driver error carrying no refusal marker. A string
 * that names no project names no project this account participates in, so it is answered here as no
 * participation (the shape `scopedTenantId` takes in src/core/db.ts).
 */
export async function participatesIn(ctx: ParticipantsCtx, projectId: string): Promise<boolean> {
  if (!isUuid(projectId)) return false;
  const standing = await forTenant(ctx)
    .select({ userId: participants.userId })
    .from(participants)
    .where(and(eq(participants.projectId, projectId), eq(participants.userId, ctx.userId)))
    .limit(1);
  return standing[0] !== undefined;
}

/**
 * The workspace roles L-ACT-03 names beside the project's own participants. They are spelled as the
 * clause spells them and typed against `WORKSPACE_ROLES`, so a roster the store widens or narrows is
 * a compile error here rather than a limb that quietly stops matching (B-17).
 */
const ADMINISTERING_ROLES = ["OWNER", "ADMIN"] as const satisfies readonly WorkspaceRole[];

/** The reason the membership read is taken under — attributable, like every system-scoped read. */
const WORKSPACE_ROLE_REASON = "R-SPINE-003 participants: the workspace role that admits a role-history read of a project the caller does not stand on";

/**
 * Does this person administer the whole workspace? Membership is not tenant-scoped state a tenant
 * handle may read — it is the row that says which workspace a person may be scoped to at all — so
 * the read runs as the system with its reason recorded, the same shape `holdsWorkspace` takes.
 */
async function administersWorkspace(ctx: ParticipantsCtx): Promise<boolean> {
  const held = await runAsSystem(WORKSPACE_ROLE_REASON)
    .select({ workspaceRole: memberships.workspaceRole })
    .from(memberships)
    .where(and(eq(memberships.tenantId, ctx.tenantId), eq(memberships.userId, ctx.userId)))
    .limit(1);
  const role = held[0]?.workspaceRole;
  return role !== undefined && (ADMINISTERING_ROLES as readonly WorkspaceRole[]).includes(role);
}

/**
 * The guard itself: a caller who neither stands on the project nor administers the workspace is
 * refused the registered PERMISSION_NOT_HELD naming ADMINISTER_PROJECT — an answer, never a fault
 * (ARCH-03, B-21). Participation is asked first because it is the cheaper question and the one most
 * callers answer yes to.
 */
export async function requireRoleHistoryAccess(ctx: ParticipantsCtx, projectId: string): Promise<void> {
  // A value that is not a uuid names no project, and the columns it would be compared against are
  // `uuid`: postgres answers 22P02, a driver error carrying no refusal marker. It is refused here
  // for the same reason `participatesIn` reads it as no participation — the workspace limb below
  // would otherwise carry a tampered field straight into a statement.
  if (!isUuid(projectId)) throw permissionNotHeld(null, ROSTER_PERMISSION);
  if (await participatesIn(ctx, projectId)) return;
  if (await administersWorkspace(ctx)) return;
  throw permissionNotHeld(null, ROSTER_PERMISSION);
}
