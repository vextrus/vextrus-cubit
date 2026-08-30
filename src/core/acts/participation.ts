// L-ACT-03: "Participation is a composite FK from the act log; the permission check lives in the
// act seam." This is that check — one guard, read from the grants the database holds minus the
// withdrawals that countermand them, used by every door the seam has (ARCH-02).
import { and, eq, inArray, participantRoleWithdrawals, participantRoles, type TenantTx } from "../db";
import { ACT_PERMISSION, isRole, permissionsOf, type ActType, type Permission } from "./law";
import { permissionNotHeld } from "./refusals";
import type { ActorCtx } from "./rendering";

/** One grant as the ledger holds it: the row's own id, and the role it bundles. */
export type RoleGrant = {
  readonly grantId: string;
  readonly role: string;
};

/**
 * Every grant standing on this project for this person, in code-point order by role, with the
 * countermanded ones removed. Read through the tenant's own handle, so row-level security has
 * already cut the rows to the actor's tenant; a person with no participation reads back nothing,
 * which is exactly what holding no permission looks like.
 *
 * "Standing" is the whole point (R-SPINE-011): `participant_roles` is append-only and owner-proof,
 * so a role taken back is still a row there — the withdrawal that answered it is a row in
 * `participant_role_withdrawals`, and the difference is what anybody actually holds.
 */
export async function effectiveGrants(tx: TenantTx, projectId: string, userId: string): Promise<readonly RoleGrant[]> {
  const granted = await tx
    .select({ grantId: participantRoles.grantId, role: participantRoles.role })
    .from(participantRoles)
    .where(and(eq(participantRoles.projectId, projectId), eq(participantRoles.userId, userId)));
  if (granted.length === 0) return [];

  const withdrawn = await tx
    .select({ grantId: participantRoleWithdrawals.grantId })
    .from(participantRoleWithdrawals)
    .where(
      inArray(
        participantRoleWithdrawals.grantId,
        granted.map((grant) => grant.grantId),
      ),
    );
  const countermanded = new Set(withdrawn.map((row) => row.grantId));
  return granted.filter((grant) => !countermanded.has(grant.grantId)).sort((left, right) => (left.role < right.role ? -1 : left.role > right.role ? 1 : 0));
}

/**
 * Every role this person holds on this project right now, in code-point order — the effective
 * reading, which is the only reading a guard, a preview or a screen has any use for (B-17). A caller
 * that needs the grant a role came in on asks `effectiveGrants` for the same rows.
 */
export async function rolesGranted(tx: TenantTx, projectId: string, userId: string): Promise<string[]> {
  return (await effectiveGrants(tx, projectId, userId)).map((grant) => grant.role);
}

/** The permissions those roles bundle. A grant naming no declared role bundles nothing. */
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

/**
 * Who holds a given role on this project right now, one entry per person. L-ACT-03 makes "a project
 * holds at least one PRINCIPAL at every moment" load-bearing law, so counting the holders is a
 * question the seam asks rather than a query each caller writes for itself (ARCH-02).
 */
export async function holdersOf(tx: TenantTx, projectId: string, role: string): Promise<readonly string[]> {
  const granted = await tx
    .select({ grantId: participantRoles.grantId, userId: participantRoles.userId })
    .from(participantRoles)
    .where(and(eq(participantRoles.projectId, projectId), eq(participantRoles.role, role)));
  if (granted.length === 0) return [];

  const withdrawn = await tx
    .select({ grantId: participantRoleWithdrawals.grantId })
    .from(participantRoleWithdrawals)
    .where(
      inArray(
        participantRoleWithdrawals.grantId,
        granted.map((grant) => grant.grantId),
      ),
    );
  const countermanded = new Set(withdrawn.map((row) => row.grantId));
  return [...new Set(granted.filter((grant) => !countermanded.has(grant.grantId)).map((grant) => grant.userId))].sort();
}
