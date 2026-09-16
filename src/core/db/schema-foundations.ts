// SEAM-TENANT: the FOUNDATIONS area's tables.
//
// The area declares its tables HERE, and re-exports them from `db/schema/foundations.ts` for the drift
// lane. `schema.ts` already enumerates this file, so a table added to the group below joins
// `SEAM_SCHEMA` and the seam's typed surface with no shared roster to edit and no other area's file to
// touch (B-19).
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper).

import { SITE_FACTS, type SiteFact } from "../site-facts/law";
import { acts } from "./schema-acts";
import { projects } from "./schema-projects";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * L-MEA-06's SITE attributes, as a ledger: every fact somebody entered about the site a project
 * stands on, kept whole and forever.
 *
 * SITE attributes are "facts no drawing carries" and are "always ENTERED", so there is nothing to
 * read them off and no default to fall back to: a fact stands here because a person entered it,
 * citing where they read it, and an absent fact is a named deferral (AM-06 §1, L-QTY-04).
 *
 * Nothing here is a "current value" — the standing is derived from these rows at read time, because a
 * stored current value is the overwrite R-TO-051 forbids. A fact is restated by entering it again, so
 * no unique constraint stands on (project, fact) and the app role holds neither UPDATE nor DELETE: a
 * correction is another row, and the append-only trigger holds the owner to the same rule (L-ACT-03).
 *
 * The derivation travels with the reading (L-REG-01): the value and unit as written, the canonical
 * metres, and the factor that carried it. The canonical unit is not a column — every site fact is a
 * length and the canon's canonical length unit is the metre, so the column says so by name rather
 * than storing a constant beside every row (L-FRM-06).
 *
 * `site_fact_id` is minted, and that is not L-REG-04's "zero minted ids": that rule binds derived ROW
 * KEYS. An entry is an appended ledger record like an act, so it is addressed the way `acts` is.
 */
export const siteFacts = pgTable(
  "site_facts",
  {
    tenantId: uuid("tenant_id").notNull(),
    siteFactId: uuid("site_fact_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId),
    fact: text("fact").$type<SiteFact>().notNull(),
    valueAsWritten: text("value_as_written").notNull(),
    unitAsWritten: text("unit_as_written").notNull(),
    canonicalMetres: text("canonical_metres").notNull(),
    factor: text("factor").notNull(),
    // Not nullable: "every entry is an act with a source note" (AM-06 §1), and a fact whose source
    // nobody stated is refused where it is made rather than stored with a hole in it.
    sourceNote: text("source_note").notNull(),
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The roster is the store's, not a writer's memory: a fact outside the closed enum cannot be
    // written at all, however it reached the insert (L-MEA-06, B-19).
    check("site_facts_fact_closed", statement`${table.fact} in (${statement.raw(closedList(SITE_FACTS))})`),
    // The read a standing is derived from: one project's entries, in the order they were made.
    index("site_facts_by_project").on(table.tenantId, table.projectId, table.enteredAt),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const FOUNDATIONS_TABLES = { siteFacts };
