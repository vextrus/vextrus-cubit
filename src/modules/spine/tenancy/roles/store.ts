// The `memberships` rows the role law reads and moves, and the one place this module speaks to the
// store about them (B-17).
//
// Every statement here runs under a recorded system reason. Membership is not tenant-scoped state a
// tenant handle may read or write: it is the row that says which workspace a person may be scoped to
// at all, and since the workspace role landed on it the row also decides who may move whom — so the
// migration's policies admit a write under a named system reason and refuse every tenant-scoped one
// (SEAM-TENANT). The reason travels with the statement and is attributable, never validated and
// then discarded.
import { and, asc, eq, holdStateLock, isUuid, memberships, runAsSystem, users, type SystemDb, type TenantTx, type WorkspaceRole } from "../../../../core/db";
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
const ACTOR_REASON = "R-SPINE-006 tenancy: the workspace a signed-in account administers, before any roster is served or role is moved";

/**
 * Which workspace an account is administering when it asks this module for something.
 *
 * It is never a value the caller wrote: the test contract fixes the three procedures' inputs, and a
 * tenant id on the wire would let a signed-in stranger name somebody else's workspace. The account's
 * memberships are what say which workspace it may be scoped to at all, and the earliest of them is
 * the one it is in — ordered by `created_at` and settled by the tenant uuid, so two memberships
 * written in one transaction still answer one workspace and not either of two.
 *
 * That is the same membership the signed-in frame puts a name to, so a roster served here is the
 * roster of the workspace the person is looking at. The statement is this module's own, under this
 * module's recorded reason: `memberships` is the tenancy module's row, and a read of it made for
 * tenant administration may not be recorded as a request to paint the frame (SEAM-TENANT — a reason
 * is attributable or it is not a reason).
 *
 * An account holding no membership answers "" — a tenant that names no workspace, which the role law
 * refuses as the stranger it is rather than carrying an empty string into a `uuid` column. A user id
 * that is not a uuid names nobody for the same reason (22P02 is a fault, not a refusal).
 */
export async function actingWorkspaceOf(userId: string): Promise<string> {
  if (!isUuid(userId)) return "";
  const held = await runAsSystem(ACTOR_REASON)
    .select({ tenantId: memberships.tenantId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt), asc(memberships.tenantId))
    .limit(1);
  return held[0]?.tenantId ?? "";
}

/** Every membership of one workspace, with the account each names. */
export async function membershipsOf(tenantId: string): Promise<readonly WorkspaceMembership[]> {
  const rows = await runAsSystem(READ_REASON)
    .select({ userId: memberships.userId, workspaceRole: memberships.workspaceRole, createdAt: memberships.createdAt, emailKey: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.userId, memberships.userId))
    .where(eq(memberships.tenantId, tenantId));
  return rows.map((row) => ({ userId: row.userId, workspaceRole: row.workspaceRole, createdAt: row.createdAt, emailKey: row.emailKey }));
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
