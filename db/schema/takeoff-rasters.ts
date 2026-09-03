// R-SPINE-022's rendered sheets, as the schema tree offers them to drizzle-kit. The definition lives
// in the seam — the ORM's table builders are a driver import, and src/core/db.ts is their one lawful
// home (SEAM-TENANT). This file is where the generator and the drift lane read it back.
export { sheetRasters } from "../../src/core/db";
