// The DOCS area's tables, as the schema tree offers them to drizzle-kit (AM-11). The definitions live
// in the seam: the ORM's table builders are a driver import, and src/core/db.ts is their one lawful
// home (SEAM-TENANT). This file is where the generator and the drift lane read them back.
export { documents } from "../../src/core/db";
