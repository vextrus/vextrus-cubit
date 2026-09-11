// SEAM-TENANT: the projects area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { BUILDING_TYPES, type BuildingType } from "../projects";
import { sql as statement } from "drizzle-orm";
import { check, index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** The five, as a SQL value list, so the constraint spells them exactly once (B-17). */
const BUILDING_TYPE_LIST = statement.raw(BUILDING_TYPES.map((type) => `'${type}'`).join(", "));

/**
 * A project (R-SPINE-010): what it is called and where it stands, in the workspace that owns it.
 *
 * Only the name is required. R-SPINE-010 enumerates the fields a project carries, and a workspace
 * naming a project before it knows its client or its storey count is naming a real project — so
 * every other field is nullable and stored as presented, and the door is where presentability is
 * judged. `building_type` is the one exception to "stored as presented": the clause closes it over
 * five names, so the CHECK admits those and nothing else, whatever writes the row.
 *
 * Target GFA is held in m² as `numeric` — B-07 keeps a figure a person entered exact from the
 * column to the page — and the square-feet readout is a conversion the format seam makes, never a
 * second stored fact.
 *
 * `archived_at` is the archived marker: AC-4's archive flips it and deletes nothing, and holding the
 * moment rather than a boolean answers "when" as well as "whether" for the same width.
 */
export const projects = pgTable(
  "projects",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    code: text("code"),
    client: text("client"),
    siteAddress: text("site_address"),
    // Stored text at M0: the district → zone derivation is book law, and nothing here derives from it.
    district: text("district"),
    buildingType: text("building_type").$type<BuildingType>(),
    storeys: integer("storeys"),
    targetGfaM2: numeric("target_gfa_m2"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("projects_building_type_closed", statement`${table.buildingType} in (${BUILDING_TYPE_LIST})`),
    // Every read of this table is tenant-scoped and then ordered by last activity: the policy adds
    // the same `tenant_id` predicate again, so without this the workspace home is a sequential scan
    // plus a sort over every tenant's projects. The order the index is built in is the order S-Home
    // asks in (the shape `tenant_ruleset_editions_scope` already has beside its own table).
    index("projects_tenant_updated").on(table.tenantId, table.updatedAt),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const PROJECTS_TABLES = {
  projects,
};
