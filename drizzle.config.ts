import { defineConfig } from 'drizzle-kit';

/**
 * C-07: PostgreSQL 16 native on 127.0.0.1:5544, no Docker in dev.
 *
 * db/schema/ does not exist yet, so `pnpm db:migrate`, `pnpm db:drift` and
 * verify's db-drift stage all skip with LANE_NOT_YET_BUILT. The drift stage
 * generates into a gitignored scratch directory so the tree stays clean.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema',
  out: './db/migrations',
  strict: true,
  verbose: false,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5544/cubit',
  },
});
