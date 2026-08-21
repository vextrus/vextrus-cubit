/**
 * AC-3 (first half) — `pnpm db:migrate` is a real lane with an append-only ledger (V-DB,
 * C-06, SEAM-TENANT's three roles).
 *
 * The ledger is what makes a migration lane auditable: a file that has been applied is
 * recorded with the checksum of what was applied, so a later edit to that file is a
 * detectable event (LEDGER_DRIFT) rather than a silent divergence between the code and the
 * database it is supposed to describe.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_ROLE, AUTH_ROLE, MIGRATE_ROLE, connectAs, endAll, query } from './support/live';
import type { Client } from 'pg';
import { REPO, lane, lastLine, lines, scratchTree } from './support/lanes';

const MIGRATIONS = join(REPO, 'db', 'migrations');
const JOURNAL = join(MIGRATIONS, 'meta', '_journal.json');

interface Applied {
  readonly tag: string;
  readonly file: string;
}

/** Journal order: drizzle's own record of which SQL file came first. */
function journal(): Applied[] {
  if (!existsSync(JOURNAL)) return [];
  const parsed = JSON.parse(readFileSync(JOURNAL, 'utf8')) as {
    entries?: readonly { tag?: unknown }[];
  };
  return (parsed.entries ?? [])
    .map((entry) => String(entry.tag ?? ''))
    .filter((tag) => tag !== '')
    .map((tag) => ({ tag, file: join(MIGRATIONS, `${tag}.sql`) }));
}

/** The checksum of a file, in either spelling of sha256 the recorder might have chosen. */
function digests(file: string): string[] {
  const bytes = readFileSync(file);
  return [
    createHash('sha256').update(bytes).digest('hex'),
    createHash('sha256').update(bytes).digest('base64'),
  ];
}

interface LedgerRow {
  readonly filename: string;
  readonly checksum: string;
  readonly appliedAt: number;
}

async function ledger(client: Client): Promise<LedgerRow[]> {
  const rows = await query(
    client,
    `select filename, checksum, applied_at from cubit_ops.migration_ledger order by applied_at, filename`,
  );
  return rows.map((row) => ({
    filename: String(row['filename']),
    checksum: String(row['checksum']),
    appliedAt: new Date(String(row['applied_at'])).getTime(),
  }));
}

let app: Client | undefined;
let entries: Applied[] = [];

beforeAll(async () => {
  entries = journal();
  app = await connectAs(APP_ROLE);
});

afterAll(async () => {
  await endAll([app]);
});

describe('AC-3 — the migration lane and its ledger (V-DB, C-06)', () => {
  it('AC-3: db/migrations is a journalled drizzle history', () => {
    expect(existsSync(JOURNAL), `${JOURNAL} does not exist — there are no migrations`).toBe(true);
    expect(entries.length, 'the journal records no migration').toBeGreaterThan(0);
    for (const entry of entries) {
      expect(existsSync(entry.file), `the journal names ${entry.tag}, but its .sql is missing`).toBe(
        true,
      );
    }
  });

  it('AC-3: the product objects are owned by cubit_migrate', async () => {
    const client = app;
    if (client === undefined) throw new Error('no connection');
    const rows = await query(
      client,
      `select tablename, tableowner from pg_tables where schemaname = 'public' order by tablename`,
    );
    expect(rows.map((row) => row['tablename'])).toContain('seam_smoke');
    for (const row of rows) {
      expect(row['tableowner'], `public.${String(row['tablename'])} is not owned by the migrate role`).toBe(
        MIGRATE_ROLE,
      );
    }
  });

  it('AC-3 / SEAM-TENANT: the cold run ensured the three roles, cubit_ops and its ledger', async () => {
    const client = app;
    if (client === undefined) throw new Error('no connection');
    // The roles are cluster-level and the ledger schema is database-level; both are what
    // "on a cold database ensures the three roles, creates schema cubit_ops" delivers, and
    // reading them together is what keeps a leftover role in a shared cluster from
    // answering for a migration that never ran.
    const roles = await query(
      client,
      `select rolname, rolcanlogin from pg_roles where rolname = any($1::text[]) order by rolname`,
      [[MIGRATE_ROLE, APP_ROLE, AUTH_ROLE]],
    );
    expect(roles.map((row) => row['rolname'])).toEqual([APP_ROLE, AUTH_ROLE, MIGRATE_ROLE]);
    for (const row of roles) {
      expect(row['rolcanlogin'], `${String(row['rolname'])} cannot log in`).toBe(true);
    }

    const schemas = await query(
      client,
      `select schema_name from information_schema.schemata where schema_name = 'cubit_ops'`,
    );
    expect(schemas.map((row) => row['schema_name'])).toEqual(['cubit_ops']);

    const columns = await query(
      client,
      `select column_name from information_schema.columns
        where table_schema = 'cubit_ops' and table_name = 'migration_ledger'
        order by column_name`,
    );
    expect(columns.map((row) => row['column_name'])).toEqual(['applied_at', 'checksum', 'filename']);
  });

  it('AC-3: every journalled file is recorded once, with the sha256 of its content', async () => {
    const client = app;
    if (client === undefined) throw new Error('no connection');
    const recorded = await ledger(client);
    expect(recorded.length, 'the ledger does not hold one row per migration file').toBe(
      entries.length,
    );
    for (const entry of entries) {
      const matches = recorded.filter((row) => row.filename.endsWith(`${entry.tag}.sql`));
      expect(matches.length, `${entry.tag}.sql is recorded ${matches.length} times`).toBe(1);
      const row = matches[0];
      if (row === undefined) continue;
      expect(
        digests(entry.file),
        `the ledger checksum for ${entry.tag}.sql is not the sha256 of the file`,
      ).toContain(row.checksum);
    }
  });

  it('AC-3: the ledger records the files in journal order', async () => {
    const client = app;
    if (client === undefined) throw new Error('no connection');
    const recorded = await ledger(client);
    const position = new Map(entries.map((entry, index) => [entry.tag, index]));
    const applied = recorded
      .map((row) => {
        const tag = [...position.keys()].find((candidate) => row.filename.endsWith(`${candidate}.sql`));
        return { index: position.get(tag ?? '') ?? -1, at: row.appliedAt };
      })
      .sort((left, right) => left.index - right.index);
    for (let i = 1; i < applied.length; i += 1) {
      const previous = applied[i - 1];
      const current = applied[i];
      if (previous === undefined || current === undefined) continue;
      expect(
        current.at >= previous.at,
        'a later migration in the journal was applied before an earlier one',
      ).toBe(true);
    }
  });

  it('AC-3: a second run applies nothing and still ends `db:migrate: ok` with exit 0', async () => {
    const client = app;
    if (client === undefined) throw new Error('no connection');
    const before = await ledger(client);
    const ran = await lane('db:migrate');
    expect(ran.code, `db:migrate exited ${ran.code}\n${ran.merged}`).toBe(0);
    // C-06: the contract line is on stdout, so `2>/dev/null` keeps it.
    expect(lastLine(ran.stdout).startsWith('db:migrate: ok'), ran.merged).toBe(true);
    const after = await ledger(client);
    expect(after, 'the second run re-applied a migration').toEqual(before);
  });

  it('AC-3: an applied file that no longer matches its checksum is LEDGER_DRIFT, exit 1', async () => {
    const client = app;
    if (client === undefined) throw new Error('no connection');
    const first = entries[0];
    expect(first, 'there is no migration to tamper with').toBeDefined();
    if (first === undefined) return;

    // The tampering happens in a copy under /tmp; the repository is never written to.
    const copy = scratchTree('ledger-drift');
    const copied = join(copy, 'db', 'migrations', `${first.tag}.sql`);
    writeFileSync(copied, `${readFileSync(copied, 'utf8')}\n-- edited after it was applied\n`);

    const before = await ledger(client);
    const ran = await lane('db:migrate', { cwd: copy });
    expect(ran.code, `db:migrate accepted an edited migration\n${ran.merged}`).toBe(1);
    expect(
      lines(ran.stdout).some((line) => line.startsWith('db:migrate: FAIL LEDGER_DRIFT')),
      `db:migrate did not report LEDGER_DRIFT on stdout\n${ran.merged}`,
    ).toBe(true);
    expect(await ledger(client), 'the refused run still changed the ledger').toEqual(before);
  });
});
