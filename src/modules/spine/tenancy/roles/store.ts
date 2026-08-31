// The `memberships` rows the role law reads and moves, and the one place this module speaks to the
// store about them (B-17).
//
// Every statement here runs under a recorded system reason. Membership is not tenant-scoped state a
// tenant handle may read or write: it is the row that says which workspace a person may be scoped to
// at all, and since the workspace role landed on it the row also decides who may move whom — so the
// migration's policies admit a write under a named system reason and refuse every tenant-scoped one
// (SEAM-TENANT). The reason travels with the statement and is attributable, never validated and
// then discarded.
import { and, eq, holdStateLock, isUuid, memberships, runAsSystem, users, type SystemDb, type TenantTx, type WorkspaceRole } from "../../../../core/db";
import { workspacePermissionNotHeld } from "../refusals";

/** One membership of a workspace, as this module reads it. */
export interface WorkspaceMembership {
  readonly userId: string;
  readonly workspaceRole: WorkspaceRole;
  readonly createdAt: Date;
  /** The key `users.email` carries the account at — a fold, never an address (see `MemberIdentity`). */
  readonly emailKey: string | null;
}

const READ_REASON = "R-SPINE-003 tenancy: the workspace roles a member holds, before a role is moved or a roster is served";
const MOVE_REASON = "R-SPINE-006 tenancy: moving or removing one member's workspace role, under the workspace's own role lock";

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
 * The one workspace an account is a member of, or null when that is not a question with one answer
 * — either it belongs to none, or it belongs to several and only the request can say which of them
 * it is acting in (R-SPINE-002: a person may belong to many tenants). Two rows are read rather than
 * one, because "exactly one" is the fact being established: an ordered `limit 1` would answer the
 * oldest membership to a person who holds four, which is a different question.
 *
 * A user id that is not a uuid names nobody, and the column is `uuid`: carried into the statement it
 * would raise 22P02, a driver error with no refusal marker.
 */
export async function soleMembershipOf(userId: string): Promise<string | null> {
  if (!isUuid(userId)) return null;
  const held = await runAsSystem(READ_REASON).select({ tenantId: memberships.tenantId }).from(memberships).where(eq(memberships.userId, userId)).limit(2);
  return held.length === 1 ? (held[0]?.tenantId ?? null) : null;
}

/** A handle the role reads and writes run on: the system handle, or the transaction holding the lock. */
type RoleHandle = Pick<SystemDb, "select" | "update" | "delete">;

/**
 * The role one person holds in one workspace, or null when they hold no membership of it. A tenant
 * or user that is not a uuid names no membership, and both columns are `uuid`: carried into the
 * statement they would raise 22P02, a driver error with no refusal marker, so a value that names
 * nobody is answered as the membership it does not name (the shape `scopedTenantId` takes).
 */
async function roleHeldOn(db: RoleHandle, tenantId: string, userId: string): Promise<WorkspaceRole | null> {
  if (!isUuid(tenantId) || !isUuid(userId)) return null;
  const held = await db
    .select({ workspaceRole: memberships.workspaceRole })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
    .limit(1);
  return held[0]?.workspaceRole ?? null;
}

/** The same question, asked outside a move: reading a roster needs no lock and takes none. */
export async function roleHeld(tenantId: string, userId: string): Promise<WorkspaceRole | null> {
  return roleHeldOn(runAsSystem(READ_REASON), tenantId, userId);
}

/**
 * The reads and writes one role move is made of, all on the connection that holds the workspace's
 * role lock — see `movingWorkspaceRoles` for why they may not be spread over more than one.
 */
export interface RoleMoveScope {
  /** The role a person holds in this workspace, or null when they hold no membership of it. */
  roleHeld(userId: string): Promise<WorkspaceRole | null>;
  /** How many memberships of this workspace hold the named role — the last-OWNER protection's count. */
  membersHolding(role: WorkspaceRole): Promise<number>;
  /** Move one membership's role, and answer the row as it now stands. */
  writeRole(subjectUserId: string, role: WorkspaceRole): Promise<{ userId: string; workspaceRole: WorkspaceRole }>;
  /** Take one membership away, and answer whether there was one to take. */
  dropMembership(subjectUserId: string): Promise<boolean>;
}

/**
 * Run one role move against the store, with everything it reads held still until it lands.
 *
 * The last-OWNER protection is a read followed by a write ("is this the only owner? then no"), and a
 * guard of that shape is only a guard while nothing may happen between its two halves. Two co-owners
 * removing each other at the same moment would otherwise both read TWO owners, both be admitted, and
 * both writes land — leaving the workspace with none, which is the one thing R-SPINE-006 says may
 * not happen. Reading afresh from the database does not help: two transactions read the same rows
 * quite happily.
 *
 * So a move takes the workspace's own role lock first (`holdStateLock`, the seam's one home for
 * this — the same idiom the sign-in limiter's window count takes), and holds it until the
 * transaction ends, whichever way it ends. The lock is on the WORKSPACE's roles rather than on the
 * rows a move happens to touch, because the fact being protected — how many owners this workspace
 * has — is about rows the transaction has not read and a concurrent move may be about to write.
 */
export async function movingWorkspaceRoles<T>(tenantId: string, work: (scope: RoleMoveScope) => Promise<T>): Promise<T> {
  return runAsSystem(MOVE_REASON).transaction(async (tx) => {
    await holdStateLock(tx as TenantTx, `workspace-roles:${tenantId}`);
    return work({
      roleHeld: (userId) => roleHeldOn(tx, tenantId, userId),

      membersHolding: async (role) => {
        const holding = await tx
          .select({ userId: memberships.userId })
          .from(memberships)
          .where(and(eq(memberships.tenantId, tenantId), eq(memberships.workspaceRole, role)));
        return holding.length;
      },

      writeRole: async (subjectUserId, role) => {
        const moved = await tx
          .update(memberships)
          .set({ workspaceRole: role })
          .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, subjectUserId)))
          .returning({ userId: memberships.userId, workspaceRole: memberships.workspaceRole });
        const row = moved[0];
        // Under the lock this is the membership having been taken away by a write of another kind —
        // a system door removing the account itself — between the guard's read and this statement.
        // It is answered with the refusal a subject who names nobody is answered with, never a bare
        // Error: a caller whose request was judged is owed an answer, not a fault id (ARCH-03, B-21).
        if (row === undefined) throw workspacePermissionNotHeld({ subjectUserId });
        return { userId: row.userId, workspaceRole: row.workspaceRole };
      },

      dropMembership: async (subjectUserId) => {
        const removed = await tx
          .delete(memberships)
          .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, subjectUserId)))
          .returning({ userId: memberships.userId });
        return removed[0] !== undefined;
      },
    });
  });
}
