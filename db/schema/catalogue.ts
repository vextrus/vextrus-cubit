// L-MEA-04's work-item catalogue and `bears` relation, as the schema tree offers them to
// drizzle-kit. The definitions themselves live in the seam: the ORM's table builders are a driver
// import, and src/core/db.ts is their one lawful home (SEAM-TENANT). This file is where the
// generator and the drift lane read them back.
export { bears, workItemCatalogue } from "../../src/core/db";
