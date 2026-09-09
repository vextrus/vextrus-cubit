// SEAM-ACT: the act log has one writer and, for the question "what does this person hold in it?",
// one reader. Tenant administration sits outside the log's writ but is coupled to it — a membership
// the log names may not be taken away underneath the record it made (R-SPINE-003) — and the module
// that enforces that coupling asks this function rather than reading the table itself (ARCH-02).
import { acts, asc, eq, isUuid, type TenantTx } from "../db";

/** Which workspace's log to ask about, when the handle can see more than one. */
export interface ActLogScope {
  readonly tenantId: string;
}

/**
 * The key a sealed handle is carried under. It is this file's own and is not exported, so nothing
 * outside can open the seal — which is the point: a type that merely renamed the tenant handle would
 * say "state your workspace" in prose and enforce none of it (B-17).
 */
const uncutRows: unique symbol = Symbol("SEAM-ACT: a transaction whose rows row-level security does not cut");

/**
 * A transaction handed over SEALED, because its rows are not cut by row-level security: a handle
 * armed with a system reason reads every workspace's log at once. Nothing can be read from it except
 * by passing it to `actsHeldBy` below, which takes the workspace as a parameter rather than leaving
 * it to a caller's habit — so an unscoped read of the log through a system handle is not something a
 * later caller can write by omission (SEAM-ACT, SEAM-TENANT).
 */
export interface UncutTx {
  readonly [uncutRows]: TenantTx;
}

/** Seal a system transaction for a reader that must name the workspace it means. */
export function uncutTx(tx: TenantTx): UncutTx {
  return { [uncutRows]: tx };
}

/**
 * The acts of the handle's tenant that this person holds, by id, in code-point order.
 *
 * "Holds" is both ways the log can name somebody: as the actor who performed the act, or as one of
 * the subjects it was performed upon. Either naming ties the record to them, so either one is what
 * the coupling asks about.
 *
 * On a tenant's own handle the rows are cut to that tenant by row-level security rather than by a
 * predicate here (SEAM-TENANT), so what this reads is what that tenant's log holds. A `userId` that
 * is not a uuid names nobody the log could carry — `acts.actor_id` is a `uuid`, so carrying it into
 * the statement would raise 22P02, a driver error with no refusal marker on it.
 *
 * `scope` states the workspace explicitly, for a handle that is not cut by row-level security: the
 * removal coupling asks this question under the tenancy module's role lock, which is held on the
 * SYSTEM handle, and a system handle reads past the policy that would otherwise have answered
 * "which workspace". Naming the workspace is the same predicate the policy states, said out loud —
 * which is what keeps it here beside the naming rule it refines, rather than in the caller (ARCH-02).
 * A tenant id that is not a uuid names no workspace, and no act, for the reason a userId does not.
 */
export function actsHeldBy(tx: TenantTx, userId: string, scope?: ActLogScope): Promise<readonly string[]>;
export function actsHeldBy(tx: UncutTx, userId: string, scope: ActLogScope): Promise<readonly string[]>;
export async function actsHeldBy(tx: TenantTx | UncutTx, userId: string, scope?: ActLogScope): Promise<readonly string[]> {
  // A sealed handle is opened here and nowhere else, and the overloads above make its workspace a
  // required argument: the one reading that sees past row-level security is the one that names what
  // it means to see.
  const handle = uncutRows in tx ? tx[uncutRows] : tx;
  if (!isUuid(userId)) return [];
  if (scope !== undefined && !isUuid(scope.tenantId)) return [];

  const columns = { actId: acts.actId, actorId: acts.actorId, subjects: acts.subjects };
  const named =
    scope === undefined
      ? await handle.select(columns).from(acts).orderBy(asc(acts.actId))
      : await handle.select(columns).from(acts).where(eq(acts.tenantId, scope.tenantId)).orderBy(asc(acts.actId));

  return named.filter((act) => act.actorId === userId || act.subjects.includes(userId)).map((act) => act.actId);
}
