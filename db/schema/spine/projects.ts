/**
 * `public.projects` — the minimal project row, and the pin that makes L-REG-07 real.
 *
 * L-REG-07: "A project pins a rule-set edition (forked platform → tenant → project at
 * creation, in one transaction, so an unpinned project is unrepresentable)." Unrepresentable
 * is a property of the schema or it is a promise: `rule_set_edition_id` is NOT NULL and
 * references `rule_set_editions`, so an INSERT that names no edition is refused by the
 * database itself, whatever the caller believed.
 *
 * R-SPINE-010 is the rest of it, added by inc-014: "name, code, client, site address +
 * district (drives zone per book), building type (residential, commercial, mixed, industrial,
 * infrastructure), storeys, target GFA (m² and sft display), notes". Everything past name and
 * code is nullable, because a project is citable from birth by those two and the remainder is
 * filled in from the project pane afterwards (docs/design/s-home.md Interpretation 3).
 *
 * Two shapes are worth stating. `building_type` is a closed enum held as text with a CHECK
 * over the five values, the `rule_set_editions.scope` treatment — a sixth type is refused by
 * the database and not only by the module above it. `target_gfa_m2` is `numeric`, never a
 * float (B-07): it is written and read as an exact decimal string, and the sft display the
 * pane derives from it is decimal arithmetic all the way down.
 *
 * Archiving is `archived_at`, not a boolean: "when" answers "whether" and says more
 * (docs/design/s-project-settings-… Interpretation 10 — archiving changes visibility on
 * S-Home, never writability or existence).
 */
import { check, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from '../core/tenants';
import { ruleSetEditions } from './rulesets';

export const projects = pgTable(
  'projects',
  {
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
    /** R-SPINE-010: who the work is for. */
    client: text('client'),
    siteAddress: text('site_address'),
    /** Stored and displayed only at M0; zone derivation per book is M5. */
    district: text('district'),
    buildingType: text('building_type'),
    storeys: integer('storeys'),
    /**
     * Target gross floor area in m², exact decimal — the sft display is derived, never stored.
     *
     * `numeric` with no precision and no scale on purpose: Postgres then keeps the value
     * exactly as it was written, so a project entered as `1000` reads back `1000` and one
     * entered as `1000.5` reads back `1000.5`. A fixed scale would hand every field on every
     * screen a rounding nobody typed, which is the opposite of what B-07 asks of a quantity.
     */
    targetGfaM2: numeric('target_gfa_m2'),
    notes: text('notes'),
    /** When the project left the default workspace home, or null while it is active. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    check(
      'projects_building_type_check',
      sql`${table.buildingType} is null or ${table.buildingType} in ('residential', 'commercial', 'mixed', 'industrial', 'infrastructure')`,
    ),
    /** A storey count is a count: zero or more, and whole by the column's own type. */
    check('projects_storeys_check', sql`${table.storeys} is null or ${table.storeys} >= 0`),
    check(
      'projects_target_gfa_check',
      sql`${table.targetGfaM2} is null or ${table.targetGfaM2} >= 0`,
    ),
  ],
);
