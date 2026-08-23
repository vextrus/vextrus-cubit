/**
 * `public.auth_mail_outbox` — the M0 mail seam.
 *
 * The e2e lane serves a production build against a cold database and has no network beyond
 * loopback, so outbound auth mail is a row rather than an SMTP conversation: the journey
 * reads the link it needs straight out of this table. `kind` is one of 'verify',
 * 'magic-link' and 'reset'; `url` is the absolute, actionable link. Real delivery is a later
 * increment's driver over the same row.
 */
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const authMailOutbox = pgTable('auth_mail_outbox', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  toEmail: text('to_email').notNull(),
  kind: text('kind').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
