import { boolean, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * The spine (R-SPINE-001, R-SPINE-002).
 *
 * Two families of table live here and they are governed differently:
 *
 *  - the identity tables better-auth owns (`user`, `session`, `account`,
 *    `verification`). They carry no `tenant_id`: an account is not a tenant's
 *    property, it belongs to a person who may belong to many tenants.
 *  - the tenant tables (`tenant`, `tenant_member`). Every one of them carries
 *    `tenant_id`, and the RLS migration finds them by that column alone — a
 *    later table cannot slip past a hand-written list (V-DB).
 */

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// --- identity (better-auth) ------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt,
  updatedAt,
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt,
  updatedAt,
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  /** better-auth 1.7 namespaces an identity by issuer: `local:credential` for a password. */
  issuer: text('issuer').notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex('account_issuer_account_id_uq').on(table.issuer, table.accountId)]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt,
  updatedAt,
});

// --- tenancy (R-SPINE-002) -------------------------------------------------

/** `personal` is minted in the user-create transaction; `team` is named by a person. */
export const TENANT_KINDS = ['personal', 'team'] as const;

/** A member's standing in one tenant. */
export const TENANT_ROLES = ['OWNER', 'MEMBER'] as const;

export const tenant = pgTable('tenant', {
  tenantId: uuid('tenant_id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  createdAt,
});

export const tenantMember = pgTable(
  'tenant_member',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.tenantId, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.userId] })],
);
