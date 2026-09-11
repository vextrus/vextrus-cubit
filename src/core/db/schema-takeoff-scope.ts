// SEAM-TENANT: the takeoff-scope area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { ELEMENT_TYPES, type ElementType } from "../catalogue/classes";
import { KINDS, type Kind } from "../catalogue/kinds";
import { SCOPE_DECLARATION_CAUSES, type ScopeDeclarationCause } from "../errors";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * R-TO-052's boundary declaration: a person's judgement that one cell of the residue stands outside
 * the project's scope, or outside this bill. One row per act — a declaration is one act over one
 * cell, never a bulk assembly (L-ACT-02) — naming the cell it stands over, the cause it stands
 * under, the act that made it and whether it is in force.
 *
 * The residue is a query and not a table (L-QTY-05): this store holds only what a PERSON declared,
 * and the machine's own causes are resolved on read, never written here.
 *
 * No foreign key to the act log, the campaign or the level: the row is written inside the act's own
 * transaction, so it cannot outrun the act row it names, and what the residue does with a row whose
 * act no longer resolves is a reading rather than a constraint — the query joins the act and a
 * declaration nobody can point at states nothing (L-ACT-01, `residueOf`).
 */
export const scopeDeclarations = pgTable(
  "scope_declarations",
  {
    tenantId: uuid("tenant_id").notNull(),
    declarationId: uuid("declaration_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    campaignId: uuid("campaign_id").notNull(),
    class: text("class").$type<ElementType>().notNull(),
    kind: text("kind").$type<Kind>().notNull(),
    levelId: uuid("level_id").notNull(),
    cause: text("cause").$type<ScopeDeclarationCause>().notNull(),
    actId: uuid("act_id").notNull(),
    inForce: boolean("in_force").notNull().default(true),
    declaredAt: timestamp("declared_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One campaign holds one declaration of one cause over one cell: a second identical declaration
    // is an act that changes nothing, refused by name before it reaches here (L-ACT-01).
    unique("scope_declarations_one_per_cell").on(table.tenantId, table.campaignId, table.class, table.kind, table.levelId, table.cause),
    check("scope_declarations_cause_closed", statement`${table.cause} in (${statement.raw(closedList(SCOPE_DECLARATION_CAUSES))})`),
    check("scope_declarations_class_closed", statement`${table.class} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
    check("scope_declarations_kind_closed", statement`${table.kind} in (${statement.raw(closedList(KINDS))})`),
    index("scope_declarations_by_campaign").on(table.tenantId, table.campaignId, table.declaredAt),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_SCOPE_TABLES = {
  scopeDeclarations,
};
