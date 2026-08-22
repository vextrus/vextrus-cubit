/**
 * inc-007a acceptance, the half that needs a live cluster — `pnpm e2e` and `pnpm seed` as
 * lanes rather than announcements (AC-1, AC-2, AC-3, AC-4; V-E2E, C-06, C-07).
 *
 * These assertions spawn `pnpm e2e`, `pnpm seed` and `pnpm verify`, and the first of those
 * drops and recreates a database, so they live here rather than in tests/toolchain: the
 * vitest stage of `pnpm verify` and CI both run without a provisioned database, exactly as
 * inc-001 reasoned when it put the db lanes' acceptance under db/__tests__.
 *
 * Every claim is read from the outside — an exit status, a contract line on stdout, rows in
 * the scratch database afterwards. Nothing here reads scripts/e2e.mjs to find out what it
 * meant to do.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO, isNested, lane, lastLine, lines, run } from './support/lanes';
import type { Ran } from './support/lanes';
import { APP_ROLE, MIGRATE_ROLE, connectTo, endAll, query, urlFor } from './support/live';
import type { Client } from 'pg';

/** C-07: the dev cluster's superuser handle — the one thing a scratch database needs made. */
const ADMIN_URL = (() => {
  const url = process.env['DATABASE_ADMIN_URL'];
  return url === undefined || url.trim() === ''
    ? 'postgres://postgres:postgres@127.0.0.1:5544/postgres'
    : url;
})();

/** The database the lane owns. AC-1's default, or whatever this workspace was pointed at. */
const E2E_DB = (() => {
  const name = process.env['CUBIT_E2E_DB'];
  return name === undefined || name.trim() === '' ? 'cubit_e2e' : name;
})();

/**
 * A table nothing in the tree creates. "Drops and recreates" is otherwise unobservable: a
 * lane that merely migrated an existing database would look identical from the outside.
 */
const SENTINEL = 'inc_007a_sentinel';

/** The database the guard test points DATABASE_URL at — never one anybody else is using. */
const GUARD_DB = `${E2E_DB}_guard`;

const open: Client[] = [];

afterAll(async () => {
  await endAll(open);
  open.length = 0;
});

async function client(url: string): Promise<Client> {
  const connected = await connectTo(url);
  open.push(connected);
  return connected;
}

const quoted = (name: string): string => `"${name.replace(/"/g, '""')}"`;

/** The same cluster, another database, as the superuser — how a scratch database is made. */
function adminUrlFor(database: string): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

async function ensureDatabase(name: string): Promise<void> {
  const admin = await client(ADMIN_URL);
  const existing = await query(admin, 'select 1 from pg_database where datname = $1', [name]);
  if (existing.length === 0) {
    await admin.query(`create database ${quoted(name)} owner ${quoted(MIGRATE_ROLE)}`);
  }
  // Schema `public` in a database the admin made is the admin's; the migrate role has to be
  // able to create the sentinel in it (db-migrate.mjs does the same for the app database).
  const here = await client(adminUrlFor(name));
  await here.query(`grant usage, create on schema public to ${quoted(MIGRATE_ROLE)}`);
}

async function plantSentinel(database: string): Promise<void> {
  const owner = await client(urlFor(database, MIGRATE_ROLE));
  await owner.query(`create table if not exists public.${quoted(SENTINEL)} (note text)`);
  await owner.query(`delete from public.${quoted(SENTINEL)}`);
  await owner.query(`insert into public.${quoted(SENTINEL)} (note) values ('inc-007a')`);
}

/** How many rows the sentinel holds, or why it cannot be counted. */
async function sentinelState(database: string): Promise<number | 'absent' | 'no-database'> {
  const admin = await client(ADMIN_URL);
  const there = await query(admin, 'select 1 from pg_database where datname = $1', [database]);
  if (there.length === 0) return 'no-database';
  const owner = await client(urlFor(database, MIGRATE_ROLE));
  const reg = await query(owner, 'select to_regclass($1) as reg', [`public.${SENTINEL}`]);
  const found = reg[0]?.['reg'];
  if (found === null || found === undefined) return 'absent';
  const counted = await query(owner, `select count(*)::int as n from public.${quoted(SENTINEL)}`);
  return Number(counted[0]?.['n'] ?? -1);
}

/** The e2e fixture tenant as the tree declares it (V-E2E: "the e2e fixture tenant"). */
function fixtureTenant(): Record<string, unknown> {
  const path = join(REPO, 'fixtures', 'e2e', 'tenant.json');
  if (!existsSync(path)) throw new Error(`${path} is not in the tree`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

/** The tenants rows carrying the fixture's id, read under system scope (SEAM-TENANT). */
async function seededTenants(database: string, id: string): Promise<Record<string, unknown>[]> {
  const app = await client(urlFor(database, APP_ROLE));
  await app.query("select set_config('cubit.scope', 'system', false)");
  return query(app, 'select * from public.tenants where id = $1', [id]);
}

async function porcelain(): Promise<string[]> {
  const status = await run('git', ['status', '--porcelain']);
  return lines(status.stdout);
}

interface DefaultRun {
  readonly ran: Ran;
  readonly before: string[];
  readonly after: string[];
}

/**
 * The default `pnpm e2e`, run once for every claim that reads it. A `beforeAll` that threw
 * would report its tests as skipped rather than failed, so the run is memoised into the
 * tests instead.
 */
let theDefaultRun: Promise<DefaultRun> | undefined;

function defaultRun(): Promise<DefaultRun> {
  theDefaultRun ??= (async () => {
    // The sentinel has to be in place before the lane runs, so the database must exist
    // before it too — on a cold machine `pnpm e2e` is the thing that would have made it.
    await ensureDatabase(E2E_DB);
    await plantSentinel(E2E_DB);
    const before = await porcelain();
    const ran = await lane('e2e');
    return { ran, before, after: await porcelain() };
  })();
  return theDefaultRun;
}

describe('inc-007a — the V-E2E lane runs (V-E2E, C-06, C-07)', () => {
  it('AC-1 / AC-3 / AC-4: `pnpm e2e` is green, says so on stdout, and no longer skips', async (ctx) => {
    // The nested `pnpm test:db` that lanes-armed.test.ts spawns re-runs this suite; the
    // spawning claims belong to the outer run, and the nested one records the skip out
    // loud rather than passing hollowly (C-06).
    ctx.skip(isNested(), 'NESTED_LANE_RUN — the outer `pnpm test:db` makes this claim');
    const { ran } = await defaultRun();
    expect(ran.code, `pnpm e2e exited ${ran.code}\n${ran.merged}`).toBe(0);

    // AC-4 / C-06: a built lane that still printed the recorded reason would be lying.
    expect(ran.merged, 'pnpm e2e still announces itself as unbuilt').not.toContain(
      'SKIP LANE_NOT_YET_BUILT',
    );

    // AC-1: "a green run's final stdout line is `e2e: ok (<S>s)`". stdout, because the gate
    // reports stderr after stdout and a contract split across the two reads out of order.
    expect(lastLine(ran.stdout), ran.merged).toMatch(/^e2e: ok \(\d+(\.\d+)?s\)$/);

    // AC-3: the default run excludes HARNESS-RED. tests/e2e/red.spec.ts fails whenever it
    // is executed, so a green default run is the only proof that it was not.
    expect(existsSync(join(REPO, 'tests', 'e2e', 'red.spec.ts'))).toBe(true);

    // Build output, traces, videos and screenshot diffs are the lane's, never the tree's:
    // a run that dirties the checkout reddens CI's "the tree is untouched" step.
    const { before, after } = await defaultRun();
    const appeared = after.filter((line) => !before.includes(line));
    expect(appeared, 'pnpm e2e left new entries in the working tree').toEqual([]);
  }, 900_000);

  it('AC-1: the run recreated the scratch database, migrated it and seeded the fixture tenant', async (ctx) => {
    ctx.skip(isNested(), 'NESTED_LANE_RUN — the outer `pnpm test:db` makes this claim');
    const { ran } = await defaultRun();
    expect(ran.code, `pnpm e2e exited ${ran.code}\n${ran.merged}`).toBe(0);

    // "drops and recreates the scratch database": the table planted before the run is gone,
    // and its database is back.
    expect(
      await sentinelState(E2E_DB),
      `${SENTINEL} survived the run: ${E2E_DB} was not dropped and recreated`,
    ).toBe('absent');

    // "migrates it with this tree's migrations": the runner's own ledger records what ran.
    const app = await client(urlFor(E2E_DB, APP_ROLE));
    const ledger = await query(app, 'select filename from cubit_ops.migration_ledger');
    expect(ledger.length, `${E2E_DB} carries no applied migrations`).toBeGreaterThan(0);

    // "seeds the e2e fixture tenant from fixtures/e2e/": the row is the fixture's own, and
    // every field the fixture declares that names a column holds the value it declares. The
    // fixture grows with the schema, so the comparison is derived from the file, not frozen.
    const tenant = fixtureTenant();
    const rows = await seededTenants(E2E_DB, String(tenant['id']));
    expect(rows.length, `the fixture tenant ${String(tenant['id'])} was not seeded`).toBe(1);
    const row = rows[0] ?? {};
    for (const [key, value] of Object.entries(tenant)) {
      const column = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      if (!(column in row) || value === null || typeof value === 'object') continue;
      expect(String(row[column]), `the seeded tenant's ${column} is not the fixture's`).toBe(
        String(value),
      );
    }
  }, 900_000);

  it('AC-2: `pnpm e2e --journey J-000` selects J-000 and is green', async (ctx) => {
    ctx.skip(isNested(), 'NESTED_LANE_RUN — the outer `pnpm test:db` makes this claim');
    // The scratch database is recreated by every run, so this one also re-proves that the
    // lane is repeatable against a database a previous run already seeded.
    const ran = await run('pnpm', ['run', 'e2e', '--journey', 'J-000']);
    expect(ran.code, `pnpm e2e --journey J-000 exited ${ran.code}\n${ran.merged}`).toBe(0);
    expect(lastLine(ran.stdout), ran.merged).toMatch(/^e2e: ok \(\d+(\.\d+)?s\)$/);

    // "runs exactly the specs whose titles match J-000": the run reports what it ran, and
    // the other two committed specs are titled HARNESS-RED and HARNESS-SELF.
    expect(ran.merged, 'the J-000 run reports no J-000 test').toContain('J-000');
    expect(ran.merged, 'the J-000 filter also ran the HARNESS-SELF spec').not.toContain(
      'HARNESS-SELF',
    );
  }, 900_000);

  it('AC-3: `pnpm e2e --journey HARNESS-RED` exits non-zero and prints no `e2e: ok`', async (ctx) => {
    ctx.skip(isNested(), 'NESTED_LANE_RUN — the outer `pnpm test:db` makes this claim');
    const ran = await run('pnpm', ['run', 'e2e', '--journey', 'HARNESS-RED']);
    // Exit-status honesty: tearing down a server and a database must not swallow the
    // runner's own answer.
    expect(ran.code, `a run of the deliberately failing spec exited 0\n${ran.merged}`).not.toBe(0);
    expect(lines(ran.stdout).filter((line) => line.startsWith('e2e: ok'))).toEqual([]);
  }, 900_000);

  it('AC-1: CUBIT_E2E_DB naming DATABASE_URL’s database is refused, and nothing is dropped', async (ctx) => {
    ctx.skip(isNested(), 'NESTED_LANE_RUN — the outer `pnpm test:db` makes this claim');
    // The guard is proved against a database made for it, not against the one this suite is
    // running in: if the guard is missing, the proof must not take the suite down with it.
    await ensureDatabase(GUARD_DB);
    await plantSentinel(GUARD_DB);
    const ran = await lane('e2e', {
      env: { DATABASE_URL: urlFor(GUARD_DB, APP_ROLE), CUBIT_E2E_DB: GUARD_DB },
    });
    expect(ran.code, `the lane accepted CUBIT_E2E_DB=${GUARD_DB}\n${ran.merged}`).not.toBe(0);
    expect(lines(ran.stdout).filter((line) => line.startsWith('e2e: ok'))).toEqual([]);
    // "refuses before connecting and drops nothing" — the sentinel and its row are exactly
    // as they were.
    expect(await sentinelState(GUARD_DB), `${GUARD_DB} was dropped by a refused run`).toBe(1);
  }, 900_000);

  it('AC-1 / AC-4: `pnpm seed` is a lane, prints its contract line, and is idempotent', async (ctx) => {
    ctx.skip(isNested(), 'NESTED_LANE_RUN — the outer `pnpm test:db` makes this claim');
    // Against the scratch database the default run already migrated and seeded: "safe to
    // run twice" is only a claim about a database that has been seeded before.
    const { ran: e2eRan } = await defaultRun();
    expect(e2eRan.code, `pnpm e2e exited ${e2eRan.code}\n${e2eRan.merged}`).toBe(0);
    const url = urlFor(E2E_DB, APP_ROLE);
    await plantSentinel(E2E_DB);

    const first = await lane('seed', { env: { DATABASE_URL: url } });
    expect(first.code, `pnpm seed exited ${first.code}\n${first.merged}`).toBe(0);
    expect(first.merged, 'pnpm seed still announces itself as unbuilt').not.toContain(
      'SKIP LANE_NOT_YET_BUILT',
    );
    expect(
      lines(first.stdout).some((line) => line.startsWith('seed:')),
      `pnpm seed printed no contract line on stdout\n${first.merged}`,
    ).toBe(true);

    const second = await lane('seed', { env: { DATABASE_URL: url } });
    expect(second.code, `the second pnpm seed exited ${second.code}\n${second.merged}`).toBe(0);

    // Idempotent: one fixture tenant, however many times the lane ran.
    const tenant = fixtureTenant();
    const rows = await seededTenants(E2E_DB, String(tenant['id']));
    expect(rows.length, 'seeding twice did not leave exactly one fixture tenant').toBe(1);

    // And a seed is not a reset: it never drops the database it is pointed at.
    expect(await sentinelState(E2E_DB), 'pnpm seed dropped the database it was pointed at').toBe(1);
  }, 900_000);

  it('AC-4 / V-VERIFY: `pnpm verify` is green with typegen and build armed by src/app', async (ctx) => {
    ctx.skip(isNested(), 'NESTED_LANE_RUN — the outer `pnpm test:db` makes this claim');
    const ran = await lane('verify');
    expect(ran.code, `verify failed\n${ran.merged}`).toBe(0);
    const printed = lines(ran.stdout);
    for (const stage of ['typegen', 'build']) {
      expect(
        printed.some((line) => new RegExp(`^verify: ${stage} ok \\(\\d+ms\\)$`).test(line)),
        `verify's ${stage} stage is not armed\n${ran.merged}`,
      ).toBe(true);
      expect(printed, `verify still skips ${stage}`).not.toContain(
        `verify: ${stage} SKIP LANE_NOT_YET_BUILT`,
      );
    }
    expect(lastLine(ran.stdout)).toMatch(/^verify: ok \([\d.]+s\)$/);

    // The build stage runs with NEXT_DIST_DIR=.next-verify so that a verify build is cold
    // and never consumes the dev build; next.config.ts honouring the variable is what makes
    // that true, and this is where it shows.
    expect(
      existsSync(join(REPO, '.next-verify')),
      'verify built, but not into .next-verify: next.config.ts does not read NEXT_DIST_DIR',
    ).toBe(true);
  }, 900_000);
});
