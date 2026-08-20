#!/usr/bin/env node
/**
 * pnpm e2e [--journey J-nnn] [--update-baselines] — V-E2E.
 *
 * Builds once, cuts the scratch database cubit_e2e, seeds the fixture tenants,
 * empties the mail outbox, then hands Playwright a server on 3211. Playwright
 * itself owns tracing, checkpoint screenshots, axe and the visual comparison
 * against the committed Linux baselines.
 *
 * A journey with no spec file is named, not silently skipped:
 * `JOURNEY_NOT_FOUND <id>` and exit 2.
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { loadEnv, ROOT, run, seconds } from './lib/run.mjs';
import { applyMigrations, recreateDatabase, roleUrls } from './lib/postgres.mjs';
import { seed } from './seed.mjs';

loadEnv();

const JOURNEYS_DIR = path.join(ROOT, 'tests/e2e/journeys');
const DATABASE = process.env.CUBIT_E2E_DATABASE ?? 'cubit_e2e';
const PORT = process.env.E2E_PORT ?? '3211';
const DIST = '.next-e2e';
const OUTBOX = path.join(ROOT, '.mail-outbox');

// --- arguments --------------------------------------------------------------
const requested = [];
let updateBaselines = false;

for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === '--journey') {
    const id = process.argv[index + 1];
    if (id === undefined) {
      console.error('e2e: --journey needs a journey id, e.g. --journey J-001');
      process.exit(2);
    }
    requested.push(id);
    index += 1;
  } else if (argument === '--update-baselines') {
    updateBaselines = true;
  } else {
    console.error(`e2e: unknown argument ${argument}`);
    process.exit(2);
  }
}

/** `J-001` names `tests/e2e/journeys/j-001.spec.ts`. */
function specFor(id) {
  return path.join(JOURNEYS_DIR, `${id.toLowerCase()}.spec.ts`);
}

const specs = [];
for (const id of requested) {
  const spec = specFor(id);
  if (!existsSync(spec)) {
    console.log(`JOURNEY_NOT_FOUND ${id}`);
    process.exit(2);
  }
  specs.push(path.relative(ROOT, spec));
}

// --- build once -------------------------------------------------------------
const startedAt = Date.now();

if (process.env.CUBIT_E2E_SKIP_BUILD !== '1') {
  const built = await run('pnpm', ['exec', 'next', 'build'], { env: { NEXT_DIST_DIR: DIST } });
  if (built !== 0) {
    console.error(`e2e FAIL build (exit ${built}) after ${seconds(startedAt)}s`);
    process.exit(built);
  }
}

// --- a scratch database, seeded ---------------------------------------------
await recreateDatabase(DATABASE);
const urls = roleUrls(DATABASE);
await applyMigrations(urls.DATABASE_URL_MIGRATE);
const planted = await seed(urls.DATABASE_URL_MIGRATE);
console.log(`e2e: ${DATABASE} seeded — ${planted.users} users, ${planted.tenants} tenants`);

// the outbox is evidence for this run only
rmSync(OUTBOX, { recursive: true, force: true });
mkdirSync(OUTBOX, { recursive: true });

// --- playwright -------------------------------------------------------------
const args = ['exec', 'playwright', 'test', ...specs];
if (updateBaselines) args.push('--update-snapshots');

const code = await run('pnpm', args, {
  env: {
    ...urls,
    NEXT_DIST_DIR: DIST,
    E2E_PORT: PORT,
    PORT,
    BETTER_AUTH_URL: `http://127.0.0.1:${PORT}`,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'e2e-only-secret-0123456789abcdef',
    MAIL_TRANSPORT: 'file',
    MAIL_OUTBOX_DIR: OUTBOX,
  },
});

if (code !== 0) {
  console.error(`E2E FAIL (exit ${code}) after ${seconds(startedAt)}s`);
  process.exit(code);
}
console.log(`E2E OK ${seconds(startedAt)}s`);
