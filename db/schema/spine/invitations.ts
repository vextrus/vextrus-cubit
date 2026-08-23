/**
 * `public.invitations` — an invitation to join a tenant, awaiting an answer (R-SPINE-003:
 * "invite by email (pending invitations, resend, revoke)").
 *
 * It carries `tenant_id`, so it is a tenant-carrying table in the RLS enumeration's sense: its
 * `tenant_isolation` policy has both arms and `db/__tests__/probes/spine.ts` exercises it.
 *
 * A revoked invitation keeps its row (docs/design/s-settings.md Interpretation 5): the screen
 * lists only `pending` ones, and history is not deleted — which is why the app role is granted
 * UPDATE and never DELETE. Accepting an invitation (linking the invited address to a
 * membership) is a later increment; the status is closed over the three words now so that
 * increment adds behaviour rather than a fourth spelling of "pending".
 */
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from '../core/tenants';
import { users } from './users';

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    /** The address invited. Not a foreign key: the invited person may have no account yet. */
    email: text('email').notNull(),
    /** The role the invitation grants, in the column's lower-case spelling. */
    role: text('role').notNull().default('member'),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    check('invitations_role_check', sql`${table.role} in ('owner', 'admin', 'member')`),
    check(
      'invitations_status_check',
      sql`${table.status} in ('pending', 'revoked', 'accepted')`,
    ),
  ],
);
