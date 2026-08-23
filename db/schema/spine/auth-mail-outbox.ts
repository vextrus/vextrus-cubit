/**
 * `public.auth_mail_outbox` — the M0 mail seam.
 *
 * The e2e lane serves a production build against a cold database and has no network beyond
 * loopback, so outbound auth mail is a row rather than an SMTP conversation: the journey
 * reads the link it needs straight out of this table. `kind` is one of 'verify',
 * 'magic-link', 'reset' and 'invite'; `url` is the absolute, actionable link. Real delivery is
 * a later increment's driver over the same row.
 *
 * `subject` and `body` are the composed words of the mail, which the three auth mails leave to
 * better-auth's own templates and the invitation writes itself (docs/design/s-settings.md §9).
 * They are nullable because a row that carries only its link is still a record of a send — and
 * the body holds the link, so the retention sweep blanks it with the url.
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
  subject: text('subject'),
  body: text('body'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
