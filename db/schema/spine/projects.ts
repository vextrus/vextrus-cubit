/**
 * `public.projects` — the minimal project row, and the pin that makes L-REG-07 real.
 *
 * L-REG-07: "A project pins a rule-set edition (forked platform → tenant → project at
 * creation, in one transaction, so an unpinned project is unrepresentable)." Unrepresentable
 * is a property of the schema or it is a promise: `rule_set_edition_id` is NOT NULL and
 * references `rule_set_editions`, so an INSERT that names no edition is refused by the
 * database itself, whatever the caller believed.
 *
 * Minimal on purpose. C-SPINE-PROJECT's client, site address, district, building type,
 * storeys, target GFA and notes — and the PRINCIPAL participant minted in the same
 * transaction — belong to the J-003 project increment, which extends this table by a later
 * migration and composes `createPinnedProject` into its own transaction.
 */
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from '../core/tenants';
import { ruleSetEditions } from './rulesets';

export const projects = pgTable('projects', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  name: text('name').notNull(),
  /** The short identifier a document cites the project by (C-SPINE-PROJECT). */
  code: text('code').notNull(),
  /** The pin. NOT NULL is the clause: an unpinned project cannot be written at all. */
  ruleSetEditionId: uuid('rule_set_edition_id')
    .notNull()
    .references(() => ruleSetEditions.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
