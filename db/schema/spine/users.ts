/**
 * `public.users` — the identity every session, account and membership hangs off
 * (R-SPINE-001).
 *
 * The property keys are better-auth's own field names, verbatim: its drizzle adapter looks a
 * column up as `schemaModel[fieldName]`, so a key spelled otherwise is a field the library
 * cannot find. The column names underneath are the tree's snake_case.
 *
 * A user carries no `tenant_id`: a user may belong to many tenants (R-SPINE-002), and the
 * row that says which is `tenant_memberships`. The table is therefore scoped to the system
 * arm alone — it is read and written by the auth seam under `cubit.scope = 'system'`.
 */
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull().default(''),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
