/**
 * `public.verifications` — the one-shot tokens behind email verification, magic links and
 * password reset (R-SPINE-001).
 *
 * A row is consumed on first use, which is why the app role holds DELETE here: a token that
 * outlives its click is a token that can be replayed.
 */
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const verifications = pgTable('verifications', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
