// SEAM-GATE's four stores — the campaign a measurement is taken under (L-REG-07) and the three the
// gate writes: published lines, rail observations and queue items (L-MEA-08, L-QTY-03, L-QTY-04) —
// as the schema tree offers them to drizzle-kit. The definitions live in the seam: the ORM's table
// builders are a driver import, and src/core/db.ts is their one lawful home (SEAM-TENANT). This file
// is where the generator and the drift lane read them back.
export { campaigns, quantityLines, queueItems, railObservations } from "../../src/core/db";
