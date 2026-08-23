/**
 * `pnpm seed` — the fixture tenant, planted in whatever database DATABASE_URL names
 * (V-E2E: "seeds a scratch DB with the e2e fixture tenant/users/project").
 *
 * Two callers, one script: `pnpm e2e` runs it against the scratch database it just made,
 * and a developer runs it by hand against their dev database. So it is idempotent — it
 * inserts what is missing and leaves what is there — and it never drops anything. A seed
 * that reset the database it was pointed at would be a reset lane wearing a seed's name;
 * dropping and recreating is scripts/e2e.mjs's job, and only against its own database.
 *
 * FORCEd row-level security binds the owner too, so nothing can be written here until the
 * connection says who it is: `cubit.scope = 'system'`, which is the only scope under which
 * a tenant row may be founded (SEAM-TENANT).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { REPO, detail, hasInputDir, say, skipLane } from './lib/lane.mjs';
import { appUrl, quoteIdent, targetDatabase } from './db-migrate.mjs';

/** Where the fixture data lives — and the directory this lane is armed by (C-06). */
const FIXTURES = 'fixtures/e2e';

/**
 * Fixture file → the table its rows belong in, in the order the foreign keys need: a
 * membership needs its tenant and its user, an account needs its user, an act needs both. A
 * later increment that founds a table adds its fixture and one row here.
 *
 * The roster the journeys drive is J-002's (R-SPINE-003): owner@ administers, worker@ is a
 * member holding one act on an open campaign — so their removal is refused `MEMBER_HAS_ACTS`
 * — and idle@ is a member holding none, so theirs is not. Every one of them signs in with the
 * same password, held here as the credential hash better-auth would have written.
 */
const ROSTER = [
  { file: 'tenant.json', table: 'tenants' },
  { file: 'users.json', table: 'users' },
  { file: 'accounts.json', table: 'accounts' },
  { file: 'tenant-memberships.json', table: 'tenant_memberships' },
  { file: 'acts.json', table: 'acts' },
];

/** The acceptance reads the fixture's keys as column names the same way (`createdAt` → `created_at`). */
function columnFor(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** One fixture file, as one row or many. A file may hold an object or an array of them. */
function rowsOf(file) {
  const parsed = JSON.parse(readFileSync(join(REPO, FIXTURES, file), 'utf8'));
  return Array.isArray(parsed) ? parsed : [parsed];
}

/** The columns the table actually has — the fixture may name more than the schema does yet. */
async function columnsOf(client, table) {
  const found = await client.query(
    'select column_name from information_schema.columns where table_schema = $1 and table_name = $2',
    ['public', table],
  );
  return new Set(found.rows.map((row) => row.column_name));
}

/**
 * Insert what is missing. `on conflict do nothing` is the whole of the idempotence: the row
 * carries a fixed id, so a second run conflicts on the primary key and writes nothing. It
 * is also all the app role is granted — it may SELECT and INSERT tenants and nothing else.
 */
async function seedRow(client, table, row, columns) {
  const named = Object.entries(row).filter(([key]) => columns.has(columnFor(key)));
  if (named.length === 0) return false;
  const names = named.map(([key]) => quoteIdent(columnFor(key))).join(', ');
  const placeholders = named.map((_, index) => `$${index + 1}`).join(', ');
  const values = named.map(([, value]) => value);
  const written = await client.query(
    `insert into public.${quoteIdent(table)} (${names}) values (${placeholders}) on conflict do nothing`,
    values,
  );
  return written.rowCount > 0;
}

async function seed() {
  const client = new pg.Client({ connectionString: appUrl() });
  await client.connect();
  try {
    // SEAM-TENANT: founding a tenant is not something a tenant does, so the connection
    // takes system scope. Without it FORCEd RLS refuses the insert with 42501.
    await client.query("select set_config('cubit.scope', 'system', false)");
    let inserted = 0;
    let present = 0;
    for (const { file, table } of ROSTER) {
      const columns = await columnsOf(client, table);
      if (columns.size === 0) {
        detail(`seed: public.${table} does not exist in this database — skipping ${file}`);
        continue;
      }
      for (const row of rowsOf(file)) {
        if (await seedRow(client, table, row, columns)) inserted += 1;
        else present += 1;
      }
    }
    return { inserted, present, database: targetDatabase(appUrl()) };
  } finally {
    await client.end();
  }
}

async function main() {
  if (!hasInputDir(FIXTURES)) {
    skipLane('seed');
    return;
  }
  try {
    const result = await seed();
    say(
      `seed: ok (inserted ${result.inserted}, already present ${result.present}, ${result.database})`,
    );
  } catch (error) {
    detail(error instanceof Error ? (error.stack ?? error.message) : String(error));
    say('seed: FAIL');
    process.exitCode = 1;
  }
}

await main();
