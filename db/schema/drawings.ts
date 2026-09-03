// The upload seam's three tables (R-SPINE-020), as the schema tree offers them to drizzle-kit: the
// content a workspace holds, the drawings made of it, and the transfers that brought it in. The
// definitions live in the seam — the ORM's table builders are a driver import, and src/core/db.ts is
// their one lawful home (SEAM-TENANT). This file is where the generator and the drift lane read them
// back.
export { drawings, files, uploads } from "../../src/core/db";
