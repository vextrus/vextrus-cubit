/**
 * `public.sessions` — one row per signed-in device (R-SPINE-001: "sessions with device list
 * and revoke").
 *
 * `active_tenant_slug` is this product's own column, not better-auth's: R-SPINE-002 says the
 * active tenant is explicit "in the URL … and in the session", so the session payload carries
 * it. It is registered on the auth instance as a session additional field, which is what puts
 * it in `/api/auth/get-session`'s JSON.
 *
 * `user_agent` is what the sessions screen parses its device summary from, and `created_at`
 * is the "signed in" time it shows.
 */
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const sessions = pgTable('sessions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  activeTenantSlug: text('active_tenant_slug'),
});
