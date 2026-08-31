// R-SPINE-003's roles as a ranking, derived from the one roster rather than restated beside it:
// `WORKSPACE_ROLES` is declared highest rank first, so a role's position in it IS its rank and a
// roster the store widens ranks the new role without an edit here (B-17, B-19).
import { WORKSPACE_ROLES, type WorkspaceRole } from "../../../../core/db";

/** Is this string one of the workspace roles the store can hold? */
export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && (WORKSPACE_ROLES as readonly string[]).includes(value);
}

/**
 * How high a role stands. The number is an implementation detail of the comparison below — it runs
 * downward, because the roster runs from the highest rank to the lowest — so nothing outside this
 * file reads it.
 */
function rankOf(role: WorkspaceRole): number {
  return WORKSPACE_ROLES.length - WORKSPACE_ROLES.indexOf(role);
}

/** Does the first role stand strictly higher than the second? */
export function outranks(role: WorkspaceRole, other: WorkspaceRole): boolean {
  return rankOf(role) > rankOf(other);
}

/** Does the first role stand at least as high as the second? */
export function standsAtLeast(role: WorkspaceRole, other: WorkspaceRole): boolean {
  return rankOf(role) >= rankOf(other);
}

/**
 * The rank a workspace's administration begins at (R-SPINE-006: "an ADMIN can neither demote nor
 * remove an OWNER" presumes an ADMIN may move everybody below them). It is spelled as the clause
 * spells it and typed against the roster, so a roster change is a compile error rather than a guard
 * that quietly admits a role nobody meant it to.
 */
const ADMINISTERING_RANK = "ADMIN" as const satisfies WorkspaceRole;

/** May a member holding this role move anybody in the workspace at all? */
export function mayAdminister(role: WorkspaceRole): boolean {
  return standsAtLeast(role, ADMINISTERING_RANK);
}

/** The role that owns a workspace — the one the last-OWNER protection counts (R-SPINE-006). */
export const OWNING_ROLE = "OWNER" as const satisfies WorkspaceRole;
