// The DOCS area’s tables, as the schema tree offers them to drizzle-kit — empty until M3 writes them
// (AM-11). The definitions live in the seam: the ORM’s table builders are a driver import, and
// src/core/db.ts is their one lawful home (SEAM-TENANT). This file is where the generator and the
// drift lane read them back, and ./index.ts already names it — so M3 declares a table in
// src/core/db/schema-docs.ts, spells it in src/core/db.ts’s roster, and re-exports it here.
export {};
