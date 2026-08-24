/**
 * `public.rule_set_editions` — the immutable rule-set editions a project pins (L-MEA-01,
 * L-REG-07, R-SPINE-012).
 *
 * L-MEA-01: "Parameters … are versioned data in an immutable rule-set edition keyed by a
 * digest over its parameter values × the (rule id, version) pairs of methods in force;
 * authoring mints a new edition, never updates one." So a row here is written once and never
 * again — the grants withhold UPDATE and DELETE from the app role and the migration's
 * statement-level trigger refuses them outright with `EDITION_IMMUTABLE`.
 *
 * One table holds all three scopes of the fork chain, because a fork is a copy of an edition
 * and not a different kind of thing: the platform seed (`tenant_id` and `parent_edition_id`
 * both NULL), a tenant's template forked from it, and a project's edition forked from that.
 * The lineage lives in `parent_edition_id` alone; the pin lives on `projects` alone, so there
 * is no circular reference between the two tables.
 *
 * It carries `tenant_id`, so it is a tenant-carrying table in the RLS enumeration's sense —
 * but with an arm the other tables have no need of: the platform row belongs to nobody and
 * every tenant scope reads it, which is what makes a fork of it possible from inside a tenant.
 */
import { check, index, pgTable, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from '../core/tenants';

export const ruleSetEditions = pgTable(
  'rule_set_editions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /**
     * Where in the fork chain this edition sits: `platform`, `tenant` or `project`, closed by
     * the check constraint below so the column cannot hold a fourth scope a caller invented.
     */
    scope: text('scope').notNull(),
    /** NULL only for the platform seed, which belongs to no tenant and is read by all of them. */
    tenantId: uuid('tenant_id').references(() => tenants.id),
    /** NULL only for the platform seed: every other edition is a fork of exactly one parent. */
    parentEditionId: uuid('parent_edition_id').references((): AnyPgColumn => ruleSetEditions.id),
    /** The rule set's name and version — `IS1200_IN` @ `2026.08` for the M0 seed. */
    name: text('name').notNull(),
    version: text('version').notNull(),
    /** The key: sha-256, lowercase hex, over the canonical form `editionDigest` fixes. */
    digest: text('digest').notNull(),
    /**
     * The parameter values, id → exact decimal string (B-07). `jsonb` and never a float
     * column: a value that became a double would round `0.08` where nobody could see it.
     */
    parameters: jsonb('parameters').$type<Record<string, string>>().notNull(),
    /** The (rule id, version) pairs of methods in force — `[]` in M0, which has no methods. */
    methods: jsonb('methods').$type<{ ruleId: string; version: number }[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    check('rule_set_editions_scope_check', sql`${table.scope} in ('platform', 'tenant', 'project')`),
    /**
     * The platform seed is the only rootless edition. Every fork names both the tenant it was
     * forked into and the edition it was forked from — a fork with no parent has no lineage,
     * and a tenant-scoped edition belonging to no tenant is nobody's.
     */
    check(
      'rule_set_editions_lineage_check',
      sql`(${table.scope} = 'platform' and ${table.tenantId} is null and ${table.parentEditionId} is null)
          or (${table.scope} <> 'platform' and ${table.tenantId} is not null and ${table.parentEditionId} is not null)`,
    ),
    check('rule_set_editions_digest_check', sql`${table.digest} ~ '^[0-9a-f]{64}$'`),
    /**
     * Idempotence, at the schema level rather than in the reader that checks first: two
     * transactions forking at once would each find no seed and each mint one.
     */
    uniqueIndex('rule_set_editions_platform_key_uniq')
      .on(table.name, table.version)
      .where(sql`${table.scope} = 'platform'`),
    uniqueIndex('rule_set_editions_tenant_template_uniq')
      .on(table.tenantId, table.name, table.version)
      .where(sql`${table.scope} = 'tenant'`),
    /** The lineage walk: one row's parent, then its parent's, for every pane that shows it. */
    index('rule_set_editions_parent_edition_id_idx').on(table.parentEditionId),
  ],
);
