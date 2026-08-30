// Who the people a project's roster names actually are. An account is not tenant-scoped state — a
// person is one account across every workspace they belong to (R-SPINE-002) — so the read runs under
// an attributable system reason, exactly as the frame's own viewer read does.
import { eq, inArray, memberships, runAsSystem, users } from "../../../core/db";
import type { MemberIdentity, ParticipantsCtx } from "./scope";

/** The reason every read of this file records against the statements it issues (SEAM-TENANT). */
const DIRECTORY_REASON = "R-SPINE-011 participants: the accounts a project's roster and role history name";

/**
 * The stored key each of these accounts is carried at, keyed by id. A person the store has no row
 * for is absent rather than invented: a roster naming an account nothing knows about would be a
 * roster with a made-up person on it.
 */
export async function identitiesOf(userIds: readonly string[]): Promise<ReadonlyMap<string, MemberIdentity>> {
  const wanted = [...new Set(userIds)];
  if (wanted.length === 0) return new Map();

  const rows = await runAsSystem(DIRECTORY_REASON).select({ userId: users.userId, emailKey: users.email }).from(users).where(inArray(users.userId, wanted));
  return new Map(rows.map((row) => [row.userId, { userId: row.userId, emailKey: row.emailKey }]));
}

/**
 * One person, named by an identity map — or by their id alone when the store holds no account row
 * for them. A person the ledger names is never dropped for want of an account row: the id is who
 * the record says it was, and a roster that omitted them would be a roster nobody can reconcile
 * against the ledger it was read from.
 */
export function identityOf(known: ReadonlyMap<string, MemberIdentity>, userId: string): MemberIdentity {
  return known.get(userId) ?? { userId, emailKey: null };
}

/**
 * The people a role may be assigned to: the workspace's members. Membership is the row that says
 * which workspace a person may be scoped to at all, so it is read as the system for the same reason
 * `holdsWorkspace` reads it that way; the order is total, so the picker a person leaves is the
 * picker they come back to.
 */
export async function assignableSubjects(ctx: ParticipantsCtx): Promise<readonly MemberIdentity[]> {
  const rows = await runAsSystem(DIRECTORY_REASON)
    .select({ userId: memberships.userId, emailKey: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.userId, memberships.userId))
    .where(eq(memberships.tenantId, ctx.tenantId));

  return rows
    .map((row) => ({ userId: row.userId, emailKey: row.emailKey }))
    .sort((left, right) => (left.userId < right.userId ? -1 : left.userId > right.userId ? 1 : 0));
}
