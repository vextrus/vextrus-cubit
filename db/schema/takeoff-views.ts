// R-TO-030's stored partition, as the schema tree offers it to drizzle-kit. The definitions live in
// the seam — the ORM's table builders are a driver import, and src/core/db.ts is their one lawful
// home (SEAM-TENANT). This file is where the generator and the drift lane read them back.
export { partitionViews, viewAssignments, viewTypeConfirmations } from "../../src/core/db";
