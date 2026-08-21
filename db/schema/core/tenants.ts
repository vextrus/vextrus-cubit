/**
 * `public.tenants` — the row every other row in the product hangs off (SEAM-TENANT).
 *
 * The tenant is scoped by its own `id` rather than by a `tenant_id` column, and a tenant
 * row is written only under system scope: creating a tenant is not something a tenant does.
 */
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tenants = pgTable('tenants', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
