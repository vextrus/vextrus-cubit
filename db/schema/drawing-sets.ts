// R-TO-005's drawing sets and L-REG-06's pinned set revisions, as the schema tree offers them to
// drizzle-kit. The definition lives in the seam — the ORM's table builders are a driver import, and
// src/core/db.ts is their one lawful home (SEAM-TENANT). This file is where the generator and the
// drift lane read them back.
export { drawingSetMembers, drawingSetRevisions, drawingSets } from "../../src/core/db";
