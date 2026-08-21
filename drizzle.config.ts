import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle (schema in TS, SQL migrations, one migration lane, drift check).
 *
 * C-07: PostgreSQL 16 native on 127.0.0.1:5544 in dev. db/ arrives with the schema
 * increment; until then `pnpm db:migrate` / `pnpm db:drift` announce the unbuilt lane and
 * verify's db-drift stage skips because db/schema is absent.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema',
  out: './db/migrations',
  strict: true,
  verbose: false,
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://postgres:postgres@127.0.0.1:5544/cubit',
  },
});
