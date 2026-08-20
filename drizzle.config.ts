import { defineConfig } from 'drizzle-kit';

/**
 * AC-08 — one schema, one migration folder, applied by the migrate role.
 * `pnpm db:drift` runs this same config into a scratch out-dir so a drift check
 * never writes into the tree.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/index.ts',
  out: process.env.DRIZZLE_OUT ?? './db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL_MIGRATE ?? '' },
  strict: true,
  verbose: false,
});
