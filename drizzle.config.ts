// The ledger's schema configuration, used by the db-drift lane of V-VERIFY: `drizzle-kit generate`
// reads the schema and writes SQL into scratch, never into the tree. The schema directory does not
// exist yet, so the lane is a recorded skip until it does (B-23); connection credentials arrive
// with the increment that first talks to the database.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
