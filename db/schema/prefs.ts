// SEAM-PREFS' store, as the schema tree offers it to drizzle-kit. The definition itself lives in the
// seam: the ORM's table builders are a driver import, and src/core/db.ts is their one lawful home
// (SEAM-TENANT). This file is where the generator and the drift lane read it back.
export { userPrefs } from "../../src/core/db";
