// Where the schema, the migrations and the database are. The schema-drift lane generates from this
// config into a scratch directory so the tree is never written to by a check (V-VERIFY).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  strict: true,
  verbose: false,
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://127.0.0.1:5544/cubit",
  },
});
