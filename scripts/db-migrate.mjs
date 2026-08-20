#!/usr/bin/env node
/**
 * pnpm db:migrate — applies db/migrations through DATABASE_URL_MIGRATE (AC-08).
 * Migrations are append-only; this script only ever moves a database forward.
 */
import { loadEnv, seconds } from './lib/run.mjs';
import { applyMigrations, ensureDatabase, roleUrls } from './lib/postgres.mjs';

loadEnv();

const startedAt = Date.now();
const database = process.argv[2] ?? process.env.CUBIT_DATABASE ?? 'cubit_dev';
const url = process.env.DATABASE_URL_MIGRATE ?? roleUrls(database).DATABASE_URL_MIGRATE;

await ensureDatabase(new URL(url).pathname.slice(1));
await applyMigrations(url);

console.log(`db:migrate ${new URL(url).pathname.slice(1)} OK ${seconds(startedAt)}s`);
