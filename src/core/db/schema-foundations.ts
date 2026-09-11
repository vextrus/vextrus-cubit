// SEAM-TENANT: the FOUNDATIONS area's tables — empty until M3 writes them (AM-11).
//
// M3's foundations rail declares its tables HERE, and re-exports them from `db/schema/foundations.ts` for the drift
// lane. `schema.ts` already enumerates this file, so a table added to the group below joins
// `SEAM_SCHEMA` and the seam's typed surface with no shared roster to edit and no other area's file to
// touch (B-19).
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper).

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const FOUNDATIONS_TABLES = {};
