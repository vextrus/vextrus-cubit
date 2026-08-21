/**
 * `public.seam_smoke` — the founding tenant-carrying table (SEAM-TENANT, R-SPINE-004).
 *
 * It exists so that the seam's guarantees are proven against a real table from the first
 * increment: scoped read, RLS refusal, cross-tenant write refusal and append-only grants
 * are asserted on whatever information_schema says carries `tenant_id`, and this is the
 * first thing it says.
 *
 * The primary key is `(tenant_id, id)`: a composite key is what a later table's composite
 * tenant FK references, so the backstop the clause names is buildable without a migration
 * that rewrites this one.
 */
import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

export const seamSmoke = pgTable(
  'seam_smoke',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    id: uuid('id')
      .notNull()
      .default(sql`gen_random_uuid()`),
    note: text('note').notNull().default(''),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
);
