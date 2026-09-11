// SEAM-TENANT: every table the tenant seam publishes, with the closed rosters their CHECKs are
// written from. The ORM's table builders are a driver import and the seam's own directory is their
// one lawful home; db/schema/*.ts is the tree drizzle-kit reads them back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so
// the dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).
//
// "Here" is this DIRECTORY, not this file (AM-11). Each area keeps its own tables, and the closed
// rosters their CHECKs are written from, in `./schema-<area>.ts`; this file is the schema: it
// ENUMERATES those files, re-exports them, and spreads their groups into `SEAM_SCHEMA`. Every
// importer still reads a table from `@/core/db` exactly as before, and an area lands a table by
// editing its own file and nothing else — five areas written at once never touch one 2,300-line file.
//
// The areas are FLAT SIBLINGS of this file rather than a `./schema/` directory beneath it, and that
// is forced rather than chosen: SEAM-TENANT's own lint rule allowlists the driver in `src/core/db.ts`
// and in the product modules ONE level under `src/core/db/`, and says in as many words that anything
// nested deeper is outside it (scripts/eslint/rules/no-db-outside-seam.mjs). A table builder in
// `src/core/db/schema/tenants.ts` would be the very bypass the ban exists for, and the tree admits no
// suppression to say otherwise (Q-08).
//
// A star re-export is what "enumerate the areas" means here, and it is not the roster src/core/db.ts
// spells name by name: that file stays the seam's public roster, unchanged and unstarred, so a scan
// that must tell a moved name from a dropped one still reads it there (ARCH-02).

import { TENANTS_TABLES } from "./schema-tenants";
import { PROJECTS_TABLES } from "./schema-projects";
import { ACTS_TABLES } from "./schema-acts";
import { IDENTITY_TABLES } from "./schema-identity";
import { INVITATIONS_TABLES } from "./schema-invitations";
import { RULESETS_TABLES } from "./schema-rulesets";
import { MODEL_TABLES } from "./schema-model";
import { PREFS_TABLES } from "./schema-prefs";
import { AI_TABLES } from "./schema-ai";
import { DRAWINGS_TABLES } from "./schema-drawings";
import { TAKEOFF_INGEST_TABLES } from "./schema-takeoff-ingest";
import { TAKEOFF_RASTERS_TABLES } from "./schema-takeoff-rasters";
import { TAKEOFF_SHEETS_TABLES } from "./schema-takeoff-sheets";
import { TAKEOFF_VIEWS_TABLES } from "./schema-takeoff-views";
import { TAKEOFF_GRIDS_TABLES } from "./schema-takeoff-grids";
import { TAKEOFF_SCHEDULES_TABLES } from "./schema-takeoff-schedules";
import { TAKEOFF_PLACEMENTS_TABLES } from "./schema-takeoff-placements";
import { DRAWING_SETS_TABLES } from "./schema-drawing-sets";
import { TAKEOFF_SCALE_TABLES } from "./schema-takeoff-scale";
import { CATALOGUE_TABLES } from "./schema-catalogue";
import { REGISTER_TABLES } from "./schema-register";
import { TAKEOFF_LEVELS_TABLES } from "./schema-takeoff-levels";
import { QUANTITY_LINES_TABLES } from "./schema-quantity-lines";
import { TAKEOFF_SCOPE_TABLES } from "./schema-takeoff-scope";
import { FOUNDATIONS_TABLES } from "./schema-foundations";
import { FRAME_TABLES } from "./schema-frame";
import { SLABS_TABLES } from "./schema-slabs";
import { MASONRY_TABLES } from "./schema-masonry";
import { REBAR_TABLES } from "./schema-rebar";
import { DOCS_TABLES } from "./schema-docs";
import { BOQ_TABLES } from "./schema-boq";

export * from "./schema-tenants";
export * from "./schema-projects";
export * from "./schema-acts";
export * from "./schema-identity";
export * from "./schema-invitations";
export * from "./schema-rulesets";
export * from "./schema-model";
export * from "./schema-prefs";
export * from "./schema-ai";
export * from "./schema-drawings";
export * from "./schema-takeoff-ingest";
export * from "./schema-takeoff-rasters";
export * from "./schema-takeoff-sheets";
export * from "./schema-takeoff-views";
export * from "./schema-takeoff-grids";
export * from "./schema-takeoff-schedules";
export * from "./schema-takeoff-placements";
export * from "./schema-drawing-sets";
export * from "./schema-takeoff-scale";
export * from "./schema-catalogue";
export * from "./schema-register";
export * from "./schema-takeoff-levels";
export * from "./schema-quantity-lines";
export * from "./schema-takeoff-scope";
export * from "./schema-foundations";
export * from "./schema-frame";
export * from "./schema-slabs";
export * from "./schema-masonry";
export * from "./schema-rebar";
export * from "./schema-docs";
export * from "./schema-boq";

/**
 * Everything the typed surface covers. A table joins the surface by joining ITS AREA’S group, and
 * the groups are enumerated here: the spread below is the whole roster, so a table added to an area
 * file is on the typed surface with no second list edited (B-19, AM-11).
 *
 * It is exported because the binding to the schema tree is a check rather than a sentence:
 * `db/schema.ts` is the barrel drizzle-kit and the drift lane read, and a test beside this file
 * compares the two rosters in both directions, so a table added to the tree and forgotten here fails
 * (B-05) — except that forgetting it one table at a time is no longer possible: only a whole area
 * file this list does not name could go missing, and `schema-aggregate.test.ts` is what says so.
 */
export const SEAM_SCHEMA = {
  ...TENANTS_TABLES,
  ...PROJECTS_TABLES,
  ...ACTS_TABLES,
  ...IDENTITY_TABLES,
  ...INVITATIONS_TABLES,
  ...RULESETS_TABLES,
  ...MODEL_TABLES,
  ...PREFS_TABLES,
  ...AI_TABLES,
  ...DRAWINGS_TABLES,
  ...TAKEOFF_INGEST_TABLES,
  ...TAKEOFF_RASTERS_TABLES,
  ...TAKEOFF_SHEETS_TABLES,
  ...TAKEOFF_VIEWS_TABLES,
  ...TAKEOFF_GRIDS_TABLES,
  ...TAKEOFF_SCHEDULES_TABLES,
  ...TAKEOFF_PLACEMENTS_TABLES,
  ...DRAWING_SETS_TABLES,
  ...TAKEOFF_SCALE_TABLES,
  ...CATALOGUE_TABLES,
  ...REGISTER_TABLES,
  ...TAKEOFF_LEVELS_TABLES,
  ...QUANTITY_LINES_TABLES,
  ...TAKEOFF_SCOPE_TABLES,
  ...FOUNDATIONS_TABLES,
  ...FRAME_TABLES,
  ...SLABS_TABLES,
  ...MASONRY_TABLES,
  ...REBAR_TABLES,
  ...DOCS_TABLES,
  ...BOQ_TABLES,
};
