#!/usr/bin/env node
/**
 * pnpm test:db — V-DB. Cuts the scratch database cubit_dbtest on 127.0.0.1:5544,
 * migrates it to head, seeds it so the RLS assertions have real rows in two
 * tenants to be wrong about, and runs the live seam tests against it (AC-09).
 */
import { loadEnv, run, seconds } from './lib/run.mjs';
import { applyMigrations, recreateDatabase, roleUrls } from './lib/postgres.mjs';
import { seed } from './seed.mjs';

loadEnv();

const DATABASE = process.env.CUBIT_DB_TEST_DATABASE ?? 'cubit_dbtest';
const startedAt = Date.now();

await recreateDatabase(DATABASE);

const urls = roleUrls(DATABASE);
await applyMigrations(urls.DATABASE_URL_MIGRATE);
await seed(urls.DATABASE_URL_MIGRATE);

console.log(`test:db ${DATABASE} migrated and seeded ${seconds(startedAt)}s`);

const code = await run('pnpm', ['exec', 'vitest', 'run'], {
  env: { ...urls, CUBIT_TEST_LANE: 'db' },
});

if (code !== 0) {
  console.error(`test:db FAIL after ${seconds(startedAt)}s`);
  process.exit(code);
}
console.log(`test:db OK ${seconds(startedAt)}s`);
