// L-ACT-03: "Role history is readable by the project's participants and tenant OWNER/ADMIN — one
// guard at the seam, used by every door; a read-path `PERMISSION_NOT_HELD` names the missing
// permission (it has no act type to name, and that is lawful)."
//
// This is that one guard. Every door of this module asks it first, so "who may see who holds which
// role" is answered in one place rather than once per transport (ARCH-02, B-17).
//
// At M0 the clause reduces to participation, exactly as the projects lifecycle guard reads it:
// `memberships` carries no role column and the tree declares no OWNER/ADMIN anywhere, so there is no
// tenant role to read. The limb is left unwritten rather than faked against a column that does not
// exist; when workspace roles land, this guard is where they widen it.
import { permissionNotHeld } from "../../../core/acts";
import { and, eq, forTenant, isUuid, participants } from "../../../core/db";
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
 * The guard itself: a caller who does not stand on the project is refused the registered
 * PERMISSION_NOT_HELD naming ADMINISTER_PROJECT — an answer, never a fault (ARCH-03, B-21).
 */
export async function requireRoleHistoryAccess(ctx: ParticipantsCtx, projectId: string): Promise<void> {
  if (await participatesIn(ctx, projectId)) return;
  throw permissionNotHeld(null, ROSTER_PERMISSION);
}
