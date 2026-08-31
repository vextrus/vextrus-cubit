// The `memberships` rows the role law reads and moves, and the one place this module speaks to the
// store about them (B-17).
//
// Every statement here runs under a recorded system reason. Membership is not tenant-scoped state a
// tenant handle may read or write: it is the row that says which workspace a person may be scoped to
// at all, and since the workspace role landed on it the row also decides who may move whom — so the
// migration's policies admit a write under a named system reason and refuse every tenant-scoped one
// (SEAM-TENANT). The reason travels with the statement and is attributable, never validated and
// then discarded.
import { and, eq, isUuid, memberships, runAsSystem, users, type WorkspaceRole } from "../../../../core/db";
import type { TenancyActor } from "../scope";

/** One membership of a workspace, as this module reads it. */
export interface WorkspaceMembership {
  readonly userId: string;
  readonly workspaceRole: WorkspaceRole;
  readonly createdAt: Date;
  /** The key `users.email` carries the account at — a fold, never an address (see `MemberIdentity`). */
  readonly emailKey: string | null;
}

const READ_REASON = "R-SPINE-003 tenancy: the workspace roles a member holds, before a role is moved or a roster is served";
const WRITE_REASON = "R-SPINE-006 tenancy: moving one member's workspace role, after the two-sided guard admitted it";
const REMOVE_REASON = "R-SPINE-006 tenancy: removing one member from a workspace, after the two-sided guard admitted it";

/** Every membership of one workspace, with the account each names. */
export async function membershipsOf(tenantId: string): Promise<readonly WorkspaceMembership[]> {
  const rows = await runAsSystem(READ_REASON)
    .select({ userId: memberships.userId, workspaceRole: memberships.workspaceRole, createdAt: memberships.createdAt, emailKey: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.userId, memberships.userId))
    .where(eq(memberships.tenantId, tenantId));
  return rows.map((row) => ({ userId: row.userId, workspaceRole: row.workspaceRole, createdAt: row.createdAt, emailKey: row.emailKey }));
}

/**
 * The role one person holds in one workspace, or null when they hold no membership of it. A tenant
 * or user that is not a uuid names no membership, and both columns are `uuid`: carried into the
 * statement they would raise 22P02, a driver error with no refusal marker, so a value that names
 * nobody is answered as the membership it does not name (the shape `scopedTenantId` takes).
 */
export async function roleHeld(tenantId: string, userId: string): Promise<WorkspaceRole | null> {
  if (!isUuid(tenantId) || !isUuid(userId)) return null;
  const held = await runAsSystem(READ_REASON)
    .select({ workspaceRole: memberships.workspaceRole })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
    .limit(1);
  return held[0]?.workspaceRole ?? null;
}

/**
 * How many memberships of this workspace hold the named role. The last-OWNER protection asks it of
 * OWNER, and it is asked of the store rather than of a roster held in memory so that two moves
 * racing each other cannot both read a workspace as having two owners.
 */
export async function membersHolding(tenantId: string, role: WorkspaceRole): Promise<number> {
  const holding = await runAsSystem(READ_REASON)
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.workspaceRole, role)));
  return holding.length;
}

/** Move one membership's role, and answer the row as it now stands. */
export async function writeRole(actor: TenancyActor, subjectUserId: string, role: WorkspaceRole): Promise<{ userId: string; workspaceRole: WorkspaceRole }> {
  const moved = await runAsSystem(WRITE_REASON)
    .update(memberships)
    .set({ workspaceRole: role })
    .where(and(eq(memberships.tenantId, actor.tenantId), eq(memberships.userId, subjectUserId)))
    .returning({ userId: memberships.userId, workspaceRole: memberships.workspaceRole });
  const row = moved[0];
  if (row === undefined) throw new Error("the workspace role write moved no membership row");
  return { userId: row.userId, workspaceRole: row.workspaceRole };
}

/** Take one membership away, and answer whether there was one to take. */
export async function dropMembership(actor: TenancyActor, subjectUserId: string): Promise<boolean> {
  const removed = await runAsSystem(REMOVE_REASON)
    .delete(memberships)
    .where(and(eq(memberships.tenantId, actor.tenantId), eq(memberships.userId, subjectUserId)))
    .returning({ userId: memberships.userId });
  return removed[0] !== undefined;
}
