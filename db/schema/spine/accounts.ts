/**
 * `public.accounts` — how a user proves who they are (R-SPINE-001).
 *
 * At M0 there is exactly one kind of row: the credential account, which holds the password
 * hash. better-auth finds it by `(userId, providerId = 'credential', issuer =
 * 'local:credential', accountId = userId)`, so the personal-tenant mint writes all four; the
 * OAuth columns are the library's and stay empty until a social provider lands.
 *
 * The unique index over `(issuer, account_id)` is better-auth's own: an identity from one
 * issuer belongs to one account.
 */
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    issuer: text('issuer').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [uniqueIndex('accounts_issuer_account_id_unique').on(table.issuer, table.accountId)],
);
