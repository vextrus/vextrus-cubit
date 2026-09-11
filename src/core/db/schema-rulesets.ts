// SEAM-TENANT: the rulesets area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import type { EditionParameter, EditionScope, MethodPair } from "../rulesets/editions/content";
import { sql as statement } from "drizzle-orm";
import { index, json, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * L-REG-07's fork chain, as a column type rather than a convention: platform → tenant → project.
 * The labels are the `EditionScope` union itself, so the store and the digest cannot come to hold
 * different ideas of what a scope is; `platform` leads because it is the head of every lineage.
 */
const RULESET_SCOPES: readonly [EditionScope, ...EditionScope[]] = ["platform", "tenant", "project"];

export const rulesetScope = pgEnum("ruleset_scope", RULESET_SCOPES);

/**
 * The platform rule-set editions (L-MEA-01): the seed `IS1200_IN @ 2026.08` and whatever later
 * editions the platform mints. No tenant id — a platform edition belongs to no workspace, and a
 * row in a tenant-scoped table that no tenant owns is a row no policy can answer for.
 *
 * The row is immutable: authoring mints a new edition and never updates one, so the migration's
 * grants and trigger are what the column definitions here cannot say. `content_digest` is
 * deliberately not unique — a verbatim fork shares its parent's digest by construction, which is
 * the whole point of a digest over content.
 *
 * The content columns are `json` rather than `jsonb`: an edition is held exactly as it was written,
 * and `jsonb` would re-order its parameter keys on the way in — an edition's own order is what a
 * surface reads its parameters back in (R-SPINE-012), and a store that shuffled it would leave no
 * order for anything downstream to answer with. Nothing here queries inside the document, which is
 * the only thing `jsonb` would buy.
 */
export const rulesetEditions = pgTable(
  "ruleset_editions",
  {
    editionId: uuid("edition_id").primaryKey().defaultRandom(),
    scope: rulesetScope("scope").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    contentDigest: text("content_digest").notNull(),
    parameters: json("parameters").$type<Readonly<Record<string, EditionParameter>>>().notNull(),
    methods: json("methods").$type<readonly MethodPair[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Identity is (scope, name, version), so the same identity twice over is one edition written twice.
  (table) => [unique("ruleset_editions_identity").on(table.scope, table.name, table.version)],
);

/**
 * A workspace's own editions (L-REG-07): the tenant template forked from the platform seed, and the
 * project pins forked from that template. `parent_edition_id` names the edition this one was forked
 * from — across both tables, so it carries no foreign key: the parent of a template lives in
 * `ruleset_editions` and the parent of a pin lives here.
 */
export const tenantRulesetEditions = pgTable(
  "tenant_ruleset_editions",
  {
    tenantId: uuid("tenant_id").notNull(),
    editionId: uuid("edition_id").primaryKey().defaultRandom(),
    scope: rulesetScope("scope").notNull(),
    // Null on the template, which belongs to the workspace rather than to any one project.
    projectId: uuid("project_id"),
    parentEditionId: uuid("parent_edition_id").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    contentDigest: text("content_digest").notNull(),
    parameters: json("parameters").$type<Readonly<Record<string, EditionParameter>>>().notNull(),
    methods: json("methods").$type<readonly MethodPair[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One template per workspace, and one pin per project: L-REG-07 pins a project once, at creation.
    uniqueIndex("tenant_ruleset_editions_template_once").on(table.tenantId).where(statement`"scope" = 'tenant'`),
    uniqueIndex("tenant_ruleset_editions_pin_once").on(table.tenantId, table.projectId).where(statement`"scope" = 'project'`),
    // The two reads a pinned project makes: its own pin, and the template a second project reuses.
    index("tenant_ruleset_editions_scope").on(table.tenantId, table.scope),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const RULESETS_TABLES = {
  rulesetEditions,
  tenantRulesetEditions,
};
