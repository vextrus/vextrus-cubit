// "Which workspaces does this account belong to, oldest membership first?" — asked once, here
// (B-17, ARCH-02).
//
// Two callers ask it: the tenancy module, deciding which workspace a signed-in account is
// administering, and the shell, painting the frame's switcher and choosing the workspace a session
// lands in. Spelled twice it is two statements that can drift into naming different workspaces for
// one account, which is a person landing in a workspace their frame does not show. So it is spelled
// once and both callers ask it under a reason of their own.
//
// `memberships` is not tenant-scoped state a tenant handle may read: it is the row that says which
// workspace a person may be scoped to at all, so the statement runs as the system with the caller's
// reason recorded beside it, never a reason this file invents on their behalf (SEAM-TENANT — a
// reason is attributable or it is not a reason).
import { asc, eq, isUuid, memberships, runAsSystem, tenants } from "@/core/db";

/** One workspace an account belongs to: the uuid a URL names it by, and the name it wears. */
export interface SeniorWorkspace {
  readonly tenantId: string;
  readonly name: string;
}

/**
 * Every workspace this account holds a membership of, in seniority order.
 *
 * The order is TOTAL, not merely stated: `created_at` names the earliest membership — the one
 * sign-up minted with the account — and the tenant uuid settles the tie two memberships written in
 * one transaction would otherwise leave open. An unordered pick would let the frame, the breadcrumb,
 * the `/` door and the rename target name a different workspace from run to run.
 *
 * A user id that is not a uuid names nobody: `memberships.user_id` is a `uuid`, so carrying such a
 * value into the statement would raise 22P02, a driver error with no refusal marker on it, for a
 * question whose honest answer is "no memberships" (the shape `scopedTenantId` takes in
 * src/core/db.ts).
 */
export async function workspacesBySeniority(reason: string, userId: string): Promise<readonly SeniorWorkspace[]> {
  if (!isUuid(userId)) return [];
  const rows = await runAsSystem(reason)
    .select({ tenantId: tenants.tenantId, name: tenants.name })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.tenantId, memberships.tenantId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt), asc(memberships.tenantId));
  return rows.map((row) => ({ tenantId: row.tenantId, name: row.name }));
}
