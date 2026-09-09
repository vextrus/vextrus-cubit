// L-REG-01's quantity register — the objects sighted, the sightings refused as evidence, the
// attribute slots and the ledger of readings — as the schema tree offers them to drizzle-kit. The
// definitions live in the seam: the ORM's table builders are a driver import, and src/core/db.ts is
// their one lawful home (SEAM-TENANT). This file is where the generator and the drift lane read them
// back.
export { refusedSightings, registerAttributes, registerObjects, registerObservations } from "../../src/core/db";
