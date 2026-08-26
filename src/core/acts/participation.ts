// L-ACT-03: "Participation is a composite FK from the act log; the permission check lives in the
// act seam." This is that check — one guard, read from the grants the database holds, used by every
// door the seam has (ARCH-02).
import { and, eq, participantRoles, type TenantTx } from "../db";
import { ACT_PERMISSION, isRole, permissionsOf, type ActType, type Permission } from "./law";
import { permissionNotHeld } from "./refusals";
import type { ActorCtx } from "./rendering";

/**
 * Every role granted on this project to this person, in code-point order. Read through the tenant's
 * own handle, so row-level security has already cut the rows to the actor's tenant; a person with no
 * participation reads back nothing, which is exactly what holding no permission looks like.
 */
export async function rolesGranted(tx: TenantTx, projectId: string, userId: string): Promise<string[]> {
  const rows = await tx
    .select({ role: participantRoles.role })
    .from(participantRoles)
    .where(and(eq(participantRoles.projectId, projectId), eq(participantRoles.userId, userId)));
  return rows.map((row) => row.role).sort();
}

/** The permissions those grants bundle. A grant naming no declared role bundles nothing. */
export async function permissionsHeld(tx: TenantTx, projectId: string, userId: string): Promise<ReadonlySet<Permission>> {
  return permissionsOf((await rolesGranted(tx, projectId, userId)).filter(isRole));
}

/**
 * The guard, before anything is read for a preview or written for a commit. The refusal names the
 * act type and the missing permission, because L-ACT-03 says it carries both — separation binds the
 * subject, never the grant, so this is the only thing standing between an actor and the act.
 */
export async function requirePermission(tx: TenantTx, ctx: ActorCtx, actType: ActType, projectId: string): Promise<void> {
  const permission = ACT_PERMISSION[actType];
  const held = await permissionsHeld(tx, projectId, ctx.userId);
  if (!held.has(permission)) throw permissionNotHeld(actType, permission);
}
