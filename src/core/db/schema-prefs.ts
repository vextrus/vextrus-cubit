// SEAM-TENANT: the prefs area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { DEFAULT_DENSITY, DENSITIES, type Density } from "../prefs/density";
import { users } from "./schema-identity";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * SEAM-PREFS' store (R-UI-005): what one person has chosen for themselves, one row per account. The
 * key is the account, so a second choice overwrites in place — a preference is a value, not a
 * history. Like the identity tables it carries no tenant id: a person is one account across every
 * workspace they belong to, so the row is scoped by the system-scope policy the migration appends.
 *
 * `density` is closed by a CHECK built from the seam's own roster, so the store cannot hold a mode
 * no table can draw; its DEFAULT is the same answer the seam gives an account with no row at all.
 */
export const userPrefs = pgTable(
  "user_prefs",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.userId),
    density: text("density").$type<Density>().notNull().default(DEFAULT_DENSITY),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("user_prefs_density_closed", statement`${table.density} in (${statement.raw(closedList(DENSITIES))})`)],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const PREFS_TABLES = {
  userPrefs,
};
