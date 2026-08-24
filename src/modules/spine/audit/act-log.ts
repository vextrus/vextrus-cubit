/**
 * The act log, as a reader reads it (R-SPINE-081, S-Audit, L-ACT-01).
 *
 * One function, and it only ever selects. L-ACT-01 makes `src/core/acts` the sole writer of
 * `acts`, `participants` and `participant_roles` and says the tables are "unimportable
 * elsewhere", so this module holds none of the three bindings: the read is raw SQL over the
 * tenant-scoped handle, exactly the shape `roleHistory` established for the same three tables
 * (src/modules/spine/projects/projects.ts). Nothing here writes, and nothing here can.
 *
 * Two things the explorer needs that the history does not:
 *
 *   - **the consequence, derived.** R-SPINE-081: "each act shows its consequence and cited
 *     evidence". The consequence of an M0 act is the `participant_roles` row that committed in
 *     the same transaction, joined on `act_id` — the grantee and the role. Evidence has no
 *     store at M0 (no act cites anything yet), so an entry carries the empty list the contract
 *     types it as, and the screen teaches the absence rather than drawing a blank cell.
 *   - **filters, by the words a reader has.** Act type is the seam's own code; actor and
 *     subject are addresses, because an address is what the roster shows and what a URL can
 *     carry. `users` holds no tenant (R-SPINE-002), so the addresses are resolved on a system
 *     handle with its reason stated — the join `participantRoster` and `listMembers` both do —
 *     and an address nobody in the tree holds resolves to nobody, which filters to no rows.
 *
 * The join is a LEFT one deliberately: the log lists the project's acts, and an act whose
 * consequence this increment cannot yet derive is still an act that happened. An inner join
 * would make the audit surface quietly shorter than the ledger it is a record of.
 */
import { runAsSystem } from '../../../core/db';
import type { ProjectCtx } from '../projects';
// The `sql` tag and the row reader, borrowed off a handle rather than imported from the driver
// (SEAM-TENANT). They are the projects module's, because this reads the same three tables the
// same way and a second copy of the borrow would be a second thing to keep true.
import { rowsOf, sqlTag } from '../projects/operators';

/** One act, as the explorer lists it (the Increment Spec's `interfaces`). */
export interface ActLogEntry {
  readonly actId: string;
  /** The act type's own code, from the seam's closed table. */
  readonly actType: string;
  readonly actorId: string;
  readonly actorEmail: string;
  /** Who the act was about — the grantee of the consequence. */
  readonly subjectId: string;
  readonly subjectEmail: string;
  /** The consequence's other half: the role the grant conferred. */
  readonly role: string;
  /** An ISO instant, so the screen renders it in the document's zone. */
  readonly at: string;
  /** M0 acts cite nothing, and the contract says so as a type. */
  readonly evidence: readonly [];
}

/** The three questions the explorer asks of the log; actor and subject are addresses. */
export interface ActLogFilter {
  readonly type?: string;
  readonly actor?: string;
  readonly subject?: string;
}

export interface ActLogInput extends ActLogFilter {
  readonly projectId: string;
}

/** The same shape as `readProject`'s guard: a segment that is not a uuid names no row. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One entry's citations. Frozen once: every entry in M0 carries the same absence. */
const CITES_NOTHING: readonly [] = Object.freeze([] as const);

const text = (row: Record<string, unknown>, column: string): string => String(row[column] ?? '');

const instant = (held: unknown): string =>
  held instanceof Date ? held.toISOString() : new Date(String(held)).toISOString();

/** A filter value a caller left blank is a filter they did not ask for. */
function asked(value: string | undefined): string | null {
  const named = (value ?? '').trim();
  return named === '' ? null : named;
}

/**
 * The addresses behind a set of user ids, and the ids behind a set of addresses.
 *
 * `users` carries no tenant at all, so it has only the system arm of its policy and the join is
 * done here rather than in SQL across two scopes — `participantRoster`'s shape, with its reason
 * stated in the same words.
 */
async function people(
  ids: readonly string[],
  addresses: readonly string[],
): Promise<readonly { id: string; email: string }[]> {
  const wantedIds = [...new Set(ids.filter((id) => UUID.test(id)))];
  const wantedEmails = [...new Set(addresses)];
  if (wantedIds.length === 0 && wantedEmails.length === 0) return [];
  return runAsSystem(
    'an act log entry names the actor and the subject by the address each of them holds',
  ).query.users.findMany({
    columns: { id: true, email: true },
    where: (row, { inArray, or }) =>
      or(
        wantedIds.length === 0 ? undefined : inArray(row.id, wantedIds),
        wantedEmails.length === 0 ? undefined : inArray(row.email, wantedEmails),
      ),
  });
}

/**
 * Every act performed on one project, newest first, filtered by what the reader asked
 * (R-SPINE-081's "filter by act type, actor, subject").
 *
 * The filters AND together: each is a separate question about the same act, and a reader who
 * names two has narrowed, not widened. A value naming nothing — an address nobody holds, an act
 * type nothing performed — answers no rows, which is the honest empty of a filter and never a
 * refusal (Design Decision Interpretation 3).
 *
 * The order is the ledger's: `created_at` descending, and `seq` after it, because `created_at`
 * defaults to the *transaction's* timestamp and two grants written in one transaction tie on it
 * (the reason `participant_roles` carries a sequence at all).
 */
export async function actLog(
  ctx: ProjectCtx,
  input: ActLogInput,
): Promise<readonly ActLogEntry[]> {
  const projectId = (input.projectId ?? '').trim();
  if (!UUID.test(projectId)) return [];

  const type = asked(input.type);
  const actor = asked(input.actor);
  const subject = asked(input.subject);

  const named = await people([], [actor, subject].filter((each) => each !== null));
  const idOf = (email: string | null): string | null =>
    email === null ? null : (named.find((person) => person.email === email)?.id ?? null);
  const actorId = idOf(actor);
  const subjectId = idOf(subject);
  // An address the workspace's own directory does not hold names nobody, and nobody performed
  // an act: the filter is honest, so it answers nothing rather than everything.
  if ((actor !== null && actorId === null) || (subject !== null && subjectId === null)) return [];

  const sql = sqlTag(ctx.db);
  const rows = await rowsOf(
    ctx.db,
    sql`select a.id as act_id,
               a.act_type,
               a.actor_id,
               a.created_at,
               g.user_id as subject_id,
               g.role
          from acts a
          left join participant_roles g on g.act_id = a.id
         where a.project_id = ${projectId}::uuid
           and (${type}::text is null or a.act_type = ${type}::text)
           and (${actorId}::uuid is null or a.actor_id = ${actorId}::uuid)
           and (${subjectId}::uuid is null or g.user_id = ${subjectId}::uuid)
         order by a.created_at desc, g.seq desc nulls last`,
  );

  const addresses = await people(
    rows.flatMap((row) => [text(row, 'actor_id'), text(row, 'subject_id')]),
    [],
  );
  const emailOf = (id: string): string =>
    addresses.find((person) => person.id === id)?.email ?? '';

  return rows.map((row) => ({
    actId: text(row, 'act_id'),
    actType: text(row, 'act_type'),
    actorId: text(row, 'actor_id'),
    actorEmail: emailOf(text(row, 'actor_id')),
    subjectId: text(row, 'subject_id'),
    subjectEmail: emailOf(text(row, 'subject_id')),
    role: text(row, 'role'),
    at: instant(row['created_at']),
    evidence: CITES_NOTHING,
  }));
}
