/**
 * `public.tenant_memberships` — the row that joins a user to a tenant (R-SPINE-002: "a user
 * may belong to many tenants").
 *
 * It carries `tenant_id`, so it is a tenant-carrying table in the RLS enumeration's sense:
 * its `tenant_isolation` policy has both arms, and `db/__tests__/probes/spine.ts` exercises
 * it. The membership minted at sign-up is the personal one; every other way of granting a
 * membership (invitations) belongs to a later increment.
 */
import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from '../core/tenants';
import { users } from './users';

export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** What the member may do. At M0 there is one value and no permission model over it. */
    role: text('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [unique('tenant_memberships_tenant_id_user_id_unique').on(table.tenantId, table.userId)],
);
