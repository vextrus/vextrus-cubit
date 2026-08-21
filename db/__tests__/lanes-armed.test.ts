/**
 * AC-4 — the lanes are armed and the gate is green (C-06, V-VERIFY, B-05).
 *
 * C-06: "a lane that does not exist yet is skipped with the recorded reason
 * LANE_NOT_YET_BUILT, never silently passed; from increment one, every stage is armed".
 * Three lanes stop being stubs in this increment and eleven remain stubs; a lane that is
 * armed must no longer announce itself as unbuilt, and a lane that is still a stub must
 * still say so out loud.
 *
 * These assertions spawn `pnpm test:db` and `pnpm verify`, so they live here rather than in
 * tests/toolchain: the vitest stage of `pnpm verify` and CI both run without a database.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO, isNested, lane, lastLine, lines, run } from './support/lanes';
import { APP_ROLE, connectTo, endAll, query, urlFor } from './support/live';
import type { Client } from 'pg';

/** AC-4: "exactly the eleven still-unbuilt lanes (only `test:db`, `db:migrate`, `db:drift` removed)". */
const STILL_STUBS = [
  'dev',
  'build',
  'start',
  'worker',
  'e2e',
  'test:golden',
  'test:docs',
  'test:perf',
  'seed',
  'gen:fixtures',
  'traceability',
];

const NOW_ARMED = ['test:db', 'db:migrate', 'db:drift'];

/** The database the nested `pnpm test:db` is told to provision — never the one we are in. */
const NESTED_DB = 'cubit_test_lane_check';

const scripts = (): Record<string, string> => {
  const parsed = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts ?? {};
};

let nestedClient: Client | undefined;

afterAll(async () => {
  await endAll([nestedClient]);
});

describe('AC-4 — the armed lanes and the gate (C-06)', () => {
  it('AC-4: package.json points test:db at its own script, and db:migrate/db:drift at theirs', () => {
    const block = scripts();
    expect(block['test:db']).toBe('node scripts/test-db.mjs');
    expect(block['db:migrate']).toBe('node scripts/db-migrate.mjs');
    expect(block['db:drift']).toBe('node scripts/db-drift.mjs');
  });

  it('AC-4 / C-06: exactly the eleven still skip out loud; the armed lanes do not', async () => {
    for (const script of STILL_STUBS) {
      const ran = await lane(script);
      expect(ran.code, `pnpm ${script} exited ${ran.code}\n${ran.merged}`).toBe(0);
      expect(lines(ran.stdout), `pnpm ${script} no longer records its reason`).toContain(
        `${script}: SKIP LANE_NOT_YET_BUILT`,
      );
    }
    // The other half of the same claim: an armed lane that still prints the recorded
    // reason is a lane that was never built (`pnpm test:db` is spawned below, not here).
    for (const script of ['db:migrate', 'db:drift']) {
      const ran = await lane(script);
      expect(ran.merged, `pnpm ${script} is still a stub`).not.toContain('SKIP LANE_NOT_YET_BUILT');
    }
  });

  it('AC-4: tests/toolchain/lane-stubs.test.ts lists exactly the eleven', () => {
    const source = readFileSync(join(REPO, 'tests', 'toolchain', 'lane-stubs.test.ts'), 'utf8');
    const roster = /const STUBS = \[([\s\S]*?)\];/.exec(source)?.[1] ?? '';
    expect(roster, 'the STUBS roster is not where the inc-000 test keeps it').not.toBe('');
    const listed = [...roster.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '');
    expect(listed.slice().sort()).toEqual(STILL_STUBS.slice().sort());
    for (const armed of NOW_ARMED) {
      expect(listed, `${armed} is armed but is still rostered as a stub`).not.toContain(armed);
    }
  });

  it('B-05 / SEAM-TENANT: the db-seam-only fixture pair still proves the rule fires', async () => {
    const bad = await run('pnpm', [
      'exec',
      'eslint',
      '--no-ignore',
      '--format',
      'json',
      'tests/lint-fixtures/db-seam-only/bad.ts',
    ]);
    expect(bad.stdout, 'eslint reported nothing at all for the bad fixture').toContain(
      'cubit/db-seam-only',
    );
    expect(bad.code, 'the driver and schema imports outside src/core/db.ts were not reported').toBe(1);

    const good = await run('pnpm', [
      'exec',
      'eslint',
      '--no-ignore',
      '--format',
      'json',
      'tests/lint-fixtures/db-seam-only/good.ts',
    ]);
    expect(good.stdout, 'the passing twin is now reported').not.toContain('cubit/db-seam-only');
    expect(good.code, good.merged).toBe(0);

    // And the exempt file is the seam itself: src/core/db.ts holds the driver import that
    // the rule reports everywhere else, and holding it is not a lint error there.
    const seam = await run('pnpm', ['exec', 'eslint', 'src/core/db.ts']);
    expect(seam.code, `linting the seam itself is not clean\n${seam.merged}`).toBe(0);
  });

  it('AC-4 / V-VERIFY: `pnpm verify` passes with the db-drift stage armed, not skipped', async () => {
    // AC-4's "`eslint .` stays green" is this run's eslint stage, which is literally
    // `eslint .` over the tree (scripts/lib/verify-roster.mjs), so it is asserted here
    // rather than spawned twice.
    if (isNested()) return;
    const ran = await lane('verify');
    expect(ran.code, `verify failed\n${ran.merged}`).toBe(0);
    const stages = lines(ran.stdout);
    expect(
      stages.some((line) => /^verify: db-drift ok \(\d+ms\)$/.test(line)),
      `verify's db-drift stage is not armed\n${ran.merged}`,
    ).toBe(true);
    expect(stages, 'the db-drift stage is still skipped').not.toContain(
      'verify: db-drift SKIP LANE_NOT_YET_BUILT',
    );
    expect(lastLine(ran.stdout)).toMatch(/^verify: ok \([\d.]+s\)$/);
  });

  it('AC-4: `pnpm test:db` cold-provisions CUBIT_TEST_DB and ends `test:db: ok`', async () => {
    // The suite this test belongs to is the one `pnpm test:db` runs, so the nested run is
    // told to provision a different database and to skip the spawning tests. One level
    // deep, and it terminates.
    if (isNested()) return;
    const ran = await lane('test:db', {
      env: {
        CUBIT_TEST_DB: NESTED_DB,
        CUBIT_VERIFIER_NESTED: '1',
        // test:db is what decides where the suite points; it must not inherit ours.
        DATABASE_URL: undefined,
      },
    });
    expect(ran.code, `test:db exited ${ran.code}\n${ran.merged}`).toBe(0);
    expect(lastLine(ran.merged), ran.merged).toBe('test:db: ok');

    // Cold-provisioned means the named database is really there, migrated.
    nestedClient = await connectTo(urlFor(NESTED_DB, APP_ROLE));
    const tables = await query(
      nestedClient,
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    const names = tables.map((row) => String(row['table_name']));
    expect(names, `${NESTED_DB} was not migrated`).toContain('seam_smoke');
    expect(names).toContain('tenants');
  });
});
