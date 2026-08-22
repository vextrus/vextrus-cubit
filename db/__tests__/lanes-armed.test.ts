/**
 * AC-4 — the lanes are armed and the gate is green (C-06, V-VERIFY, B-05).
 *
 * C-06: "a lane that does not exist yet is skipped with the recorded reason
 * LANE_NOT_YET_BUILT, never silently passed; from increment one, every stage is armed".
 * Three lanes stop being stubs in this increment; a lane that is armed must no longer
 * announce itself as unbuilt, and a lane that is still a stub must still say so out loud.
 *
 * That claim is a *relationship*, not a membership list. C-06 licenses the recorded reason
 * for "a lane that does not exist yet", and AM-02 has the foundation series arm its stages
 * progressively — "from the end of that series every stage is armed". Neither clause fixes
 * a roster, so nothing below freezes one: the roster is read from the tree on every run and
 * the rule is asserted over whatever it holds. (Arbitration, 2026-08-22: the eleven-name
 * list this file used to carry was a snapshot of the inc-001 roster, and it asserted the
 * opposite of C-06 for `e2e` and `seed` the moment inc-007a armed those two lanes.)
 *
 * These assertions spawn `pnpm test:db` and `pnpm verify`, so they live here rather than in
 * tests/toolchain: the vitest stage of `pnpm verify` and CI both run without a database.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { NESTED, NESTED_SENTINEL, REPO, isNested, lane, lastLine, lines, run } from './support/lanes';
import { APP_ROLE, connectTo, endAll, query, urlFor } from './support/live';
import type { Client } from 'pg';

/**
 * AC-4 / C-06: the lanes that are still unbuilt, as the inc-000 test rosters them. Derived
 * from that file on every run — arming a lane is exactly the act of taking it off this
 * roster (inc-001 did it for the db lanes, inc-007a for `e2e` and `seed`), so a copy frozen
 * here would contradict the tree one increment later.
 */
function stubRoster(): string[] {
  const source = readFileSync(join(REPO, 'tests', 'toolchain', 'lane-stubs.test.ts'), 'utf8');
  const roster = /const STUBS = \[([\s\S]*?)\];/.exec(source)?.[1] ?? '';
  expect(roster, 'the STUBS roster is not where the inc-000 test keeps it').not.toBe('');
  return [...roster.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '');
}

/**
 * The lanes that have been built by now. This list only ever grows: C-06's recorded reason
 * belongs to a lane that does not exist yet, so a lane that exists never returns to the
 * roster. `e2e` and `seed` join it in inc-007a; their contract lines are asserted by
 * db/__tests__/e2e-lane.test.ts, which is what spawns those two (a `pnpm e2e` builds the
 * app), so here they are only held to the roster half of the rule.
 */
const NOW_ARMED = ['test:db', 'db:migrate', 'db:drift', 'e2e', 'seed'];

/**
 * The database the nested `pnpm test:db` is told to provision — never the one we are in.
 * C-07 expects parallel lanes on one shared 127.0.0.1:5544 with "per-lane offsets", so the
 * name is derived from this workspace's own CUBIT_TEST_DB rather than hardcoded: two
 * concurrent workspaces must not both drop the same database out from under each other.
 * The `_lane_check` suffix keeps the nested run off the database the outer suite occupies.
 */
const NESTED_DB = `${process.env['CUBIT_TEST_DB'] ?? 'cubit_test'}_lane_check`;

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

  it('AC-4 / C-06: every rostered stub skips out loud; the armed lanes do not', async () => {
    for (const script of stubRoster()) {
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

  it('AC-4: the roster and the armed lanes are disjoint, and the roster is of real lanes', () => {
    const block = scripts();
    const listed = stubRoster();

    // C-06: a built lane that still printed the recorded reason would be reporting a lie,
    // which is why arming a lane means taking it off this roster.
    for (const armed of NOW_ARMED) {
      expect(listed, `${armed} is armed but is still rostered as a stub`).not.toContain(armed);
    }

    // The other half of the same rule, and the half that keeps the roster from being emptied
    // into a vacuous pass: a script still routed through the shared stub has no lane of its
    // own, so it must still be listed. Derived from package.json, so it stays true as later
    // increments arm the rest — and goes quiet by itself when none are left.
    for (const [name, command] of Object.entries(block)) {
      if (!/scripts\/lane\.mjs\b/.test(command)) continue;
      expect(listed, `pnpm ${name} is still a stub but has left the roster`).toContain(name);
    }
    for (const name of listed) {
      expect(Object.keys(block), `the roster lists ${name}, which is not a script`).toContain(name);
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

  it('AC-4 / V-VERIFY: `pnpm verify` passes with the db-drift stage armed, not skipped', async (ctx) => {
    // AC-4's "`eslint .` stays green" is this run's eslint stage, which is literally
    // `eslint .` over the tree (scripts/lib/verify-roster.mjs), so it is asserted here
    // rather than spawned twice.
    // C-06: inside the nested spawn this claim is not made, so it is recorded as a skip —
    // never a pass, which would report green for verification that never happened.
    ctx.skip(isNested(), 'NESTED_LANE_RUN — the outer `pnpm test:db` makes this claim');
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

  it('AC-4: `pnpm test:db` cold-provisions CUBIT_TEST_DB and ends `test:db: ok`', async (ctx) => {
    // The suite this test belongs to is the one `pnpm test:db` runs, so the nested run is
    // told to provision a different database and to skip the spawning tests. One level
    // deep, and it terminates — and the nested level records the skip out loud (C-06)
    // rather than passing hollowly.
    ctx.skip(isNested(), 'NESTED_LANE_RUN — the outer `pnpm test:db` makes this claim');
    const ran = await lane('test:db', {
      env: {
        CUBIT_TEST_DB: NESTED_DB,
        [NESTED]: NESTED_SENTINEL,
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
