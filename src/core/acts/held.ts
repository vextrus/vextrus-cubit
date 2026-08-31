// SEAM-ACT: the act log has one writer and, for the question "what does this person hold in it?",
// one reader. Tenant administration sits outside the log's writ but is coupled to it — a membership
// the log names may not be taken away underneath the record it made (R-SPINE-003) — and the module
// that enforces that coupling asks this function rather than reading the table itself (ARCH-02).
import { acts, asc, isUuid, type TenantTx } from "../db";

/**
 * The acts of the handle's tenant that this person holds, by id, in code-point order.
 *
 * "Holds" is both ways the log can name somebody: as the actor who performed the act, or as one of
 * the subjects it was performed upon. Either naming ties the record to them, so either one is what
 * the coupling asks about.
 *
 * The rows are cut to the acting tenant by row-level security rather than by a predicate here: the
 * handle is the tenant's own (SEAM-TENANT), so what this reads is what that tenant's log holds. A
 * `userId` that is not a uuid names nobody the log could carry — `acts.actor_id` is a `uuid`, so
 * carrying it into the statement would raise 22P02, a driver error with no refusal marker on it.
 *
 * The scope is the whole of the tenant's log because at this milestone the log's whole of it is
 * live: a narrower scope belongs in this query, beside the naming rule it refines, and nowhere else.
 */
export async function actsHeldBy(tx: TenantTx, userId: string): Promise<readonly string[]> {
  if (!isUuid(userId)) return [];

  const named = await tx.select({ actId: acts.actId, actorId: acts.actorId, subjects: acts.subjects }).from(acts).orderBy(asc(acts.actId));

  return named.filter((act) => act.actorId === userId || act.subjects.includes(userId)).map((act) => act.actId);
}
