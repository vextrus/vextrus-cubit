/**
 * The act log and the participation it is written against (SEAM-ACT, L-ACT-01, L-ACT-03).
 *
 * Three tables, and the shape between them is the law's:
 *
 *   - `participants` — L-ACT-03: "Participants attach to (project, user), append-only,
 *     mandatory". One row per person per project, unique on the pair, so a participation is a
 *     thing that either exists or does not rather than a count of grants.
 *   - `participant_roles` — the grants themselves, kept as history. A demotion is a new row and
 *     never an edit of the old one, so "who could do what, when" is answerable after the fact;
 *     the current role is the last row for the pair.
 *   - `acts` — L-ACT-01's append-only ledger, which this increment gives the project it happened
 *     on and a composite foreign key `(project_id, actor_id) → participants(project_id, user_id)`.
 *     That is L-ACT-03's "Participation is a composite FK from the act log", and it is what makes
 *     an act by somebody who was never a participant unrepresentable rather than merely refused.
 *     The key matches SIMPLE, so an act carrying no project (the tenant-administration acts
 *     R-SPINE-003 already writes) stays legal.
 *
 * Append-only is a grant, not a convention: `cubit_app` holds SELECT and INSERT on all three and
 * neither UPDATE nor DELETE, so an act that happened cannot be edited into one that did not.
 * Writing them is the act seam's alone (`src/core/acts`); nothing else in `src/` may reach them.
 */
import { foreignKey, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from '../core/tenants';
import { projects } from './projects';
import { users } from './users';

/**
 * Who takes part in a project. Mandatory and append-only: a row is written when a person is
 * first given a role there, and nothing removes it — M0 has no act type that removes a
 * participant, and L-ACT-03 protects the last PRINCIPAL on the grant rather than on the row.
 */
export const participants = pgTable(
  'participants',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    /**
     * The pair L-ACT-03 attaches participation to — and the key the act log's composite foreign
     * key points at, which is why it is a constraint rather than an index: a target Postgres
     * will accept for a reference is what makes participation a database fact.
     */
    unique('participants_project_id_user_id_uniq').on(table.projectId, table.userId),
    index('participants_user_id_idx').on(table.userId),
  ],
);

export const acts = pgTable(
  'acts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    /** What was done, as a code from the act-type enum the seam closes (`src/core/acts`). */
    actType: text('act_type').notNull(),
    /**
     * The project the act was performed on. NULL is "no project of its own": tenant
     * administration acts on the tenant, and the composite key below matches SIMPLE, so those
     * rows are not asked for a participation that could not exist.
     */
    projectId: uuid('project_id').references(() => projects.id),
    /** The campaign the act sits on, when it sits on one. Null is "no campaign of its own". */
    campaignRef: text('campaign_ref'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    /**
     * L-ACT-03: "Participation is a composite FK from the act log." An act on a project is by
     * somebody who takes part in that project, decided by the database and not by whoever
     * remembered to check.
     */
    foreignKey({
      columns: [table.projectId, table.actorId],
      foreignColumns: [participants.projectId, participants.userId],
      name: 'acts_project_id_actor_id_participants_fk',
    }),
    /**
     * The act log read by project — the role history pane's own read, and the participation
     * check's. `acts_actor_id_idx` is 0002's, hand-written below its generated DDL and left
     * there: a landed migration is superseded, never edited, and re-declaring it here would
     * make this migration try to create an index the database already has.
     */
    index('acts_project_id_idx').on(table.projectId),
  ],
);

/**
 * The grants, as history (R-SPINE-011: "role history visible").
 *
 * Every row cites the act that made it, so a role somebody holds is traceable to the human who
 * gave it to them. The current role of a pair is its last row; there is no column to update,
 * which is what "append-only" means here.
 */
export const participantRoles = pgTable(
  'participant_roles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** A member of the role enum L-ACT-03 closes, held as the seam's own spelling of it. */
    role: text('role').notNull(),
    /** The act that granted it — L-ACT-01's "act row and state change commit in one transaction". */
    actId: uuid('act_id')
      .notNull()
      .references(() => acts.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('participant_roles_project_id_user_id_idx').on(table.projectId, table.userId),
    index('participant_roles_act_id_idx').on(table.actId),
  ],
);
