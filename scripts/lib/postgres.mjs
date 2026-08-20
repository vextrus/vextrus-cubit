/**
 * C-07 — PostgreSQL 16 native on 127.0.0.1:5544, no Docker in dev. Everything
 * that needs a database (db:migrate, test:db, e2e, checkup) bootstraps through
 * here so the three roles and the URL shapes are written down exactly once.
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';

export const PG_HOST = process.env.PGHOST_CUBIT ?? '127.0.0.1';
export const PG_PORT = process.env.PGPORT_CUBIT ?? '5544';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../db/migrations', import.meta.url));

/** The roles, in the order a fresh cluster needs them. */
export const ROLES = [
  // the owner: it runs DDL and holds BYPASSRLS so the ledger and the seam tests
  // can read the truth a policy would otherwise hide
  { name: 'cubit_migrate', password: 'cubit_migrate', attributes: 'login bypassrls createdb' },
  { name: 'cubit_app', password: 'cubit_app', attributes: 'login' },
  { name: 'cubit_auth', password: 'cubit_auth', attributes: 'login' },
];

export function adminUrl() {
  return process.env.POSTGRES_ADMIN_URL ?? `postgres://postgres:postgres@${PG_HOST}:${PG_PORT}/postgres`;
}

/** The three role URLs for one database. */
export function roleUrls(database) {
  return {
    DATABASE_URL_MIGRATE: `postgres://cubit_migrate:cubit_migrate@${PG_HOST}:${PG_PORT}/${database}`,
    DATABASE_URL_APP: `postgres://cubit_app:cubit_app@${PG_HOST}:${PG_PORT}/${database}`,
    DATABASE_URL_AUTH: `postgres://cubit_auth:cubit_auth@${PG_HOST}:${PG_PORT}/${database}`,
  };
}

export async function withClient(url, run) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** Creates the three roles if the cluster does not carry them yet. */
export async function ensureRoles() {
  await withClient(adminUrl(), async (admin) => {
    for (const role of ROLES) {
      const { rows } = await admin.query('select 1 from pg_roles where rolname = $1', [role.name]);
      if (rows.length > 0) continue;
      await admin.query(`create role "${role.name}" ${role.attributes} password '${role.password}'`);
    }
  });
}

export async function databaseExists(name) {
  return withClient(adminUrl(), async (admin) => {
    const { rows } = await admin.query('select 1 from pg_database where datname = $1', [name]);
    return rows.length > 0;
  });
}

export async function ensureDatabase(name) {
  await ensureRoles();
  if (await databaseExists(name)) return;
  await withClient(adminUrl(), (admin) => admin.query(`create database "${name}" owner cubit_migrate`));
}

/** A scratch database is dropped and re-cut every run: test:db and e2e both want a clean sheet. */
export async function recreateDatabase(name) {
  await ensureRoles();
  await withClient(adminUrl(), async (admin) => {
    await admin.query(
      'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
      [name],
    );
    await admin.query(`drop database if exists "${name}"`);
    await admin.query(`create database "${name}" owner cubit_migrate`);
  });
}

/** Applies db/migrations to a database through the migrate role (AC-08). */
export async function applyMigrations(migrateUrl) {
  const pool = new pg.Pool({ connectionString: migrateUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await pool.end();
  }
}
