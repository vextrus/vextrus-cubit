// R-SPINE-011: "role history visible". One entry per grant and per withdrawal the project's ledgers
// hold — what moved, whose role it was, who moved it and when — behind the module's one guard.
//
// The record reads downward: oldest first, newest last, because an append-only ledger's newest row
// arriving at the bottom is the visible append. Withdrawn roles stay on it; nothing here is edited
// away, which is the whole reason the withdrawal is a second row rather than an edit of the first.
import { acts, asc, eq, forTenant, participantRoleWithdrawals, participantRoles } from "@/core/db";
import { refusalOf } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { identitiesOf, identityOf } from "./directory";
import { requireRoleHistoryAccess } from "./guard";
import type { MemberIdentity, ParticipantsCtx } from "./scope";

/**
 * What this module's own access guard refuses with. Read off the closed register in value position
 * rather than re-spelled, so the seam and the registry entry cannot come to disagree (ARCH-02).
 */
const ACCESS_REFUSED = refusalOf("PERMISSION_NOT_HELD").code;

/** Which way a role moved. The same two the act's own input carries (L-ACT-03). */
export type RoleDirection = "GRANT" | "WITHDRAW";

/**
 * One movement on the record. `subject` is the person the role moved on or off; `actor` is the
 * person who moved it — two different facts, kept in two different fields, because an entry that
 * held both people in one bag would not say who did what to whom.
 *
 * `actor` is null for the grant a project's creation installed: L-ACT-03 says creation inserts its
 * creator as PRINCIPAL, which is not an act somebody performed, and `participant_roles.act_id` is
 * nullable for exactly that row. Naming a performer there would be inventing one.
 */
export interface RoleHistoryEntry {
  readonly direction: RoleDirection;
  readonly role: string;
  readonly subject: MemberIdentity;
  readonly actor: MemberIdentity | null;
  readonly occurredAt: Date;
}

/** A project, as a caller names it. */
export interface ProjectRef {
  readonly projectId: string;
}

/** The row shapes the two ledgers answer with, before the people on them are named. */
type Movement = {
  readonly direction: RoleDirection;
  readonly role: string;
  readonly subjectId: string;
  readonly actorId: string | null;
  readonly occurredAt: Date;
  /** The ledger row's own id, so two movements recorded in one instant still have an order. */
  readonly rowId: string;
};

export async function roleHistory(ctx: ParticipantsCtx, ref: ProjectRef): Promise<readonly RoleHistoryEntry[]> {
  await requireRoleHistoryAccess(ctx, ref.projectId);
  return gatheredHistory(ctx, ref);
}

/**
 * The same record, with this module's own access judgement ANSWERED rather than thrown: null exactly
 * when `requireRoleHistoryAccess` refuses this reader, and the entries otherwise.
 *
 * A caller gathering several projects wants to pass over the ones it may not read, and a caller that
 * reads that judgement off a refusal CODE caught around the whole call reads the same answer from
 * anywhere below it — a scoped handle that refuses, a guard of some other door — turning a genuine
 * refusal into silence. Whether this reader may read this project is a judgement this module makes
 * about its own ledgers, so this module is where it is distinguished from every other refusal
 * (B-17, ARCH-02). Everything else travels.
 */
export async function roleHistoryIfReadable(ctx: ParticipantsCtx, ref: ProjectRef): Promise<readonly RoleHistoryEntry[] | null> {
  try {
    await requireRoleHistoryAccess(ctx, ref.projectId);
  } catch (thrown) {
    if (refusalCodeOf(thrown) === ACCESS_REFUSED) return null;
    throw thrown;
  }
  return gatheredHistory(ctx, ref);
}

/** The record itself, once the guard above has admitted the reader. */
async function gatheredHistory(ctx: ParticipantsCtx, ref: ProjectRef): Promise<readonly RoleHistoryEntry[]> {
  const db = forTenant(ctx);

  // The actor is read off the act each row points at — the log is where "who did this" lives
  // (L-ACT-01), so neither ledger carries a second copy of it.
  const granted = await db
    .select({ rowId: participantRoles.grantId, role: participantRoles.role, subjectId: participantRoles.userId, occurredAt: participantRoles.grantedAt, actorId: acts.actorId })
    .from(participantRoles)
    .leftJoin(acts, eq(acts.actId, participantRoles.actId))
    .where(eq(participantRoles.projectId, ref.projectId))
    .orderBy(asc(participantRoles.grantedAt), asc(participantRoles.grantId));

  const withdrawn = await db
    .select({
      rowId: participantRoleWithdrawals.withdrawalId,
      role: participantRoleWithdrawals.role,
      subjectId: participantRoleWithdrawals.userId,
      occurredAt: participantRoleWithdrawals.withdrawnAt,
      actorId: acts.actorId,
    })
    .from(participantRoleWithdrawals)
    .leftJoin(acts, eq(acts.actId, participantRoleWithdrawals.actId))
    .where(eq(participantRoleWithdrawals.projectId, ref.projectId))
    .orderBy(asc(participantRoleWithdrawals.withdrawnAt), asc(participantRoleWithdrawals.withdrawalId));

  const movements: Movement[] = [
    ...granted.map((row) => ({ ...row, direction: "GRANT" as const })),
    ...withdrawn.map((row) => ({ ...row, direction: "WITHDRAW" as const })),
  ].sort(inOrder);

  const known = await identitiesOf(movements.flatMap((movement) => (movement.actorId === null ? [movement.subjectId] : [movement.subjectId, movement.actorId])));

  return movements.map((movement) => ({
    direction: movement.direction,
    role: movement.role,
    subject: identityOf(known, movement.subjectId),
    actor: movement.actorId === null ? null : identityOf(known, movement.actorId),
    occurredAt: movement.occurredAt,
  }));
}

/**
 * The order the record reads in, and it is total: the moment a movement was written, then the
 * ledger row's own id, so two movements the same transaction wrote in the same instant do not swap
 * places between two readings of the same history.
 */
function inOrder(left: Movement, right: Movement): number {
  const when = left.occurredAt.getTime() - right.occurredAt.getTime();
  if (when !== 0) return when;
  return left.rowId < right.rowId ? -1 : left.rowId > right.rowId ? 1 : 0;
}
