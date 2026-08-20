import { describe, it, expect, afterAll } from 'vitest';
// eslint-disable-next-line cubit/db-seam-only -- the ledger is read as a database fact, not through a tenant handle
import { Client } from 'pg';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// V-DB / AC-08 / AC-09 — the migration ledger: applied migrations equal
// committed files, and committed migrations are append-only.

const ROOT = process.cwd();
const MIGRATIONS = path.join(ROOT, 'db/migrations');

function committedMigrations(): string[] {
  expect(existsSync(MIGRATIONS), 'db/migrations is missing').toBe(true);
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

const url = process.env.DATABASE_URL_MIGRATE;
if (!url) {
  throw new Error('DATABASE_URL_MIGRATE is not set — pnpm test:db must export the migrate role URL');
}
const client = new Client({ connectionString: url });
await client.connect();

afterAll(async () => {
  await client.end();
});

describe('AC-09 migration ledger', () => {
  it('AC-09: a drizzle migration ledger table exists in the scratch DB', async () => {
    const { rows } = await client.query<{ n: string }>(
      `select count(*)::text as n from information_schema.tables
        where table_name like '%drizzle_migrations%'`,
    );
    expect(Number(rows[0]?.n ?? '0'), 'no drizzle migration ledger table').toBeGreaterThan(0);
  });

  it('AC-09: applied migrations equal committed migration files', async () => {
    const { rows: located } = await client.query<{ table_schema: string; table_name: string }>(
      `select table_schema, table_name from information_schema.tables
        where table_name like '%drizzle_migrations%' limit 1`,
    );
    const schema = located[0]?.table_schema as string;
    const table = located[0]?.table_name as string;
    const { rows } = await client.query<{ n: string }>(
      `select count(*)::text as n from "${schema}"."${table}"`,
    );
    expect(
      Number(rows[0]?.n ?? '0'),
      'the ledger and db/migrations/*.sql disagree — the scratch DB is not at head',
    ).toBe(committedMigrations().length);
  });

  it('AC-08: the drizzle journal lists exactly the committed sql files', () => {
    const journalPath = path.join(MIGRATIONS, 'meta/_journal.json');
    expect(existsSync(journalPath), 'db/migrations/meta/_journal.json is missing').toBe(true);
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries?: Array<{ tag: string }>;
    };
    const tags = (journal.entries ?? []).map((e) => `${e.tag}.sql`).sort();
    expect(tags).toEqual(committedMigrations());
  });
});

describe('AC-08 migrations are append-only', () => {
  it('AC-08: no committed migration has ever been modified or deleted', () => {
    const changed = execFileSync(
      'git',
      ['log', '--diff-filter=MD', '--name-only', '--pretty=format:', '--', 'db/migrations'],
      { cwd: ROOT, encoding: 'utf8' },
    )
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.endsWith('.sql'));
    expect([...new Set(changed)], 'a migration was rewritten or removed — migrations are append-only').toEqual(
      [],
    );
  });
});
