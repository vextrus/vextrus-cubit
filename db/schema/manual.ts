// S-Measure's two tables — a project's conditions and the hand measurements recorded against the
// register — as the schema tree offers them to drizzle-kit. The definitions live in the seam: the ORM's
// table builders are a driver import, and src/core/db.ts is their one lawful home (SEAM-TENANT). This
// file is where the generator and the drift lane read them back.
export { conditions, manualMeasurements } from "../../src/core/db";
