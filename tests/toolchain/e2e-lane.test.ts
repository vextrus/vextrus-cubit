/**
 * inc-007a acceptance, the half that needs no database and no build — the V-E2E lane's
 * committed surface: what playwright.config.ts pins, what is in the tree beside it, and
 * what stops claiming the lane is unbuilt (AC-1, AC-2, AC-4; V-E2E, C-06, C-07).
 *
 * The lane's *behaviour* — a real `pnpm e2e` that builds, seeds, serves and exits with the
 * run's true status — is asserted in db/__tests__/e2e-lane.test.ts, because it needs
 * PostgreSQL and `pnpm verify`'s vitest stage runs without one (the inc-001 precedent).
 *
 * Nothing here pins a roster, a file list or a count that a later increment may lawfully
 * grow: the claims are "this member is present", "that member is gone", "this rule holds
 * for every file that exists".
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../playwright.config';

const REPO = process.cwd();

const read = (...parts: string[]): string => readFileSync(join(REPO, ...parts), 'utf8');
const there = (...parts: string[]): boolean => existsSync(join(REPO, ...parts));

function scripts(): Record<string, string> {
  const parsed = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
  return parsed.scripts ?? {};
}

/** Every *.spec.ts under tests/e2e, however deep — the rule below holds for all of them. */
function specFiles(dir = join(REPO, 'tests', 'e2e')): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...specFiles(path));
    else if (entry.endsWith('.spec.ts')) found.push(path);
  }
  return found;
}

describe('inc-007a — the V-E2E lane as the tree carries it (V-E2E, C-06, C-07)', () => {
  it('AC-2 / V-E2E: playwright.config.ts pins traces, video, the baseline route and the ratio', () => {
    // V-E2E: "runs Playwright journeys (J-nnn) with traces … video on failure".
    expect(config.use?.trace, 'traces are not retained on failure').toBe('retain-on-failure');
    expect(config.use?.video, 'video is not retained on failure').toBe('retain-on-failure');

    // AC-2: the baselines are routed by snapshotPathTemplate into tests/e2e/baselines/.
    // The template is read for what it must do — carry `{arg}` (so an array name keeps its
    // directory) and land under a `baselines` directory — not for one exact spelling.
    const template = config.snapshotPathTemplate;
    expect(typeof template, 'snapshotPathTemplate is not set, so baselines land beside the specs').toBe(
      'string',
    );
    expect(String(template), 'the template drops the array name').toContain('{arg}');
    expect(String(template), 'the template does not route into a baselines directory').toContain(
      'baselines',
    );
    expect(String(template), 'the template does not end in the snapshot extension').toMatch(
      /\{ext\}$/,
    );

    // V-E2E: "visual comparisons … maxDiffPixelRatio 0.002".
    expect(config.expect?.toHaveScreenshot?.maxDiffPixelRatio).toBe(0.002);

    // C-07: the e2e build is served on 3211, and loopback is the only address the lane
    // knows — "model calls use fixture transport" is satisfied here by having no network
    // path at all.
    expect(String(config.use?.baseURL)).toMatch(/^http:\/\/127\.0\.0\.1:3211\/?$/);
    expect(String(config.testDir).replace(/^\.\//, '')).toBe('tests/e2e');
  });

  it('AC-2: the Linux baseline for J-000 is committed, and no snapshot name is a string', () => {
    // AC-2: "matches the committed Linux baseline". A baseline that is not in the tree is
    // written on first run and compared against itself for ever after.
    const baseline = join(REPO, 'tests', 'e2e', 'baselines', 'smoke', 'root.png');
    expect(existsSync(baseline), `${baseline} is not in the tree`).toBe(true);
    const bytes = readFileSync(baseline);
    // A PNG, not a placeholder someone touched into existence.
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.byteLength).toBeGreaterThan(256);

    // AC-2: "snapshot names passed as arrays, never slash-containing strings". A string
    // name has its slashes flattened, so `'smoke/root.png'` silently becomes
    // `smoke-root.png` and the routed directory is never used. The rule is asserted over
    // every spec that exists, so it still holds for the journeys of later increments.
    const specs = specFiles();
    expect(specs.length, 'there are no Playwright specs under tests/e2e').toBeGreaterThan(0);
    for (const spec of specs) {
      const offending = readFileSync(spec, 'utf8').match(/toHaveScreenshot\(\s*['"`]/g) ?? [];
      expect(offending, `${spec} passes a string snapshot name`).toEqual([]);
    }
  });

  it('AC-4 / C-06: e2e and seed are built lanes, so the stub roster no longer claims them', () => {
    const block = scripts();
    expect(block['e2e']).toBe('node scripts/e2e.mjs');
    expect(block['seed']).toBe('node scripts/seed.mjs');

    const source = read('tests', 'toolchain', 'lane-stubs.test.ts');
    const roster = /const STUBS = \[([\s\S]*?)\];/.exec(source)?.[1] ?? '';
    expect(roster, 'the STUBS roster is not where the inc-000 test keeps it').not.toBe('');
    const listed = [...roster.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '');

    // C-06's recorded reason is for a lane that does not exist yet; a built lane that still
    // printed it would be reporting a lie, which is why inc-001 took the db lanes off this
    // roster rather than leaving them on it.
    for (const armed of ['e2e', 'seed']) {
      expect(listed, `${armed} is armed but is still rostered as a stub`).not.toContain(armed);
    }

    // The other half of the rule, and the half that keeps the roster honest as later
    // increments arm more lanes: a script that is still routed through scripts/lane.mjs has
    // no lane of its own, so it must still be rostered. No count and no frozen list — the
    // roster is derived from package.json every time this runs.
    for (const [name, command] of Object.entries(block)) {
      if (!/scripts\/lane\.mjs\b/.test(command)) continue;
      expect(listed, `pnpm ${name} is still a stub but has left the roster`).toContain(name);
    }
    for (const name of listed) {
      expect(Object.keys(block), `the roster lists ${name}, which is not a script`).toContain(name);
    }
  });

  it('AC-4 / V-E2E: CI runs the lane on every push and PR, with PostgreSQL 16 and chromium', () => {
    // V-E2E: "Runs in CI on every PR and by the harness gate."
    const ci = read('.github', 'workflows', 'ci.yml');
    expect(ci).toMatch(/^on:/m);
    expect(ci, 'CI does not run on push').toMatch(/^\s{2}push:/m);
    expect(ci, 'CI does not run on pull requests').toMatch(/^\s{2}pull_request:/m);

    expect(ci, 'no CI step runs the e2e lane').toMatch(/pnpm (run )?e2e\b/);
    // C-07: PostgreSQL 16, reached on 5544 — the port the lane's URLs name.
    expect(ci, 'CI provisions no PostgreSQL 16').toMatch(/postgres:16/);
    expect(ci, 'CI does not put PostgreSQL on 5544').toMatch(/5544/);
    // A Playwright lane with no browser installed fails for a reason that is not the code's.
    expect(ci, 'CI does not provision the chromium browser').toMatch(
      /playwright install[^\n]*chromium/,
    );
  });

  it('AC-4: the placeholder app root exists and next.config.ts reads NEXT_DIST_DIR', () => {
    // AC-4: verify's typegen and build stages are armed by the existence of src/app
    // (scripts/lib/verify-roster.mjs keys them on that directory), and this increment is
    // the one that delivers it.
    expect(there('src', 'app'), 'src/app does not exist, so verify still skips typegen and build').toBe(
      true,
    );
    expect(there('src', 'app', 'layout.tsx')).toBe(true);
    expect(there('src', 'app', 'page.tsx')).toBe(true);
    // The test contract's only testid, on the only route the lane serves. That it is
    // really on the *served* page is J-000's claim; that it is in the source is this one's.
    expect(read('src', 'app', 'page.tsx')).toContain('app-root');

    // verify's build stage runs with NEXT_DIST_DIR=.next-verify so a verify build is cold
    // and never consumes the dev build. Next reads distDir from next.config, so the config
    // has to honour the variable — proved behaviourally by db/__tests__/e2e-lane.test.ts,
    // which reads .next-verify out of a green `pnpm verify`.
    expect(there('next.config.ts'), 'next.config.ts is not in the tree').toBe(true);
    expect(read('next.config.ts'), 'next.config.ts never reads NEXT_DIST_DIR').toContain(
      'NEXT_DIST_DIR',
    );
  });

  it('AC-1: the e2e fixture tenant is declared under fixtures/e2e/', () => {
    // V-E2E: "seeds a scratch DB with the e2e fixture tenant/users/project". The schema
    // defines tenants today, so that is what the fixture carries; it grows with the schema.
    const path = join(REPO, 'fixtures', 'e2e', 'tenant.json');
    expect(existsSync(path), `${path} is not in the tree`).toBe(true);
    const tenant = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    // A fixed UUID: a seed that generated its id would not be the same tenant twice, and
    // `pnpm seed` has to be idempotent.
    expect(String(tenant['id'])).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(typeof tenant['name'], 'the fixture tenant has no name').toBe('string');
    expect(String(tenant['name']).trim()).not.toBe('');
  });
});
