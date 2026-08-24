/**
 * inc-008 acceptance — the identity spine, judged from outside it (R-SPINE-001, R-SPINE-002,
 * S-Auth, J-001, Q-12).
 *
 * It lives under db/__tests__ because every claim here either needs a live cluster or spawns
 * a lane that drops and recreates a database: `pnpm verify`'s vitest stage and CI both run
 * without a provisioned database, and a live-DB test there would be red for a reason that has
 * nothing to do with the code under review. The increment's test contract says the same thing
 * in as many words, and it is run as
 *
 *     pnpm test:db db/__tests__/j-001-auth.test.ts
 *
 * A bare `pnpm vitest run db/__tests__/...` finds no tests: the root config excludes db/**.
 *
 * Three arms, in the order the file runs them:
 *
 *   SURFACE — fs and git only. What the increment must have committed (the journey, its page
 *   object, its baselines, the Design Decision, the migration, the probe) and what it must
 *   have left alone (J-000's root page, spec and baseline, byte for byte).
 *
 *   SEAM — the migrated scratch database `pnpm test:db` provisioned, plus
 *   `createUserWithPersonalTenant` driven directly through an injected handle. Atomicity is
 *   proved by making the *database* refuse a write inside the mint and then showing that
 *   nothing of the mint survives — no knowledge of how the function spells its statements.
 *
 *   LANE — the e2e lane (build, cold database, migrations, seed, `--journey J-000`), then
 *   J-001 itself against the build it left, then the cold e2e database both filled, then the
 *   rate limit, probed against that same build.
 *
 * Nothing here reads src/server/** or src/app/** to find out what the Builder meant. The
 * function under test is loaded by its exported name; everything else is an exit code, a
 * contract line, an HTTP status, or a row.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO, isNested, lastLine, run } from './support/lanes';
import type { Ran } from './support/lanes';
import {
  APP_ROLE,
  MIGRATE_ROLE,
  attempt,
  connectAs,
  connectTo,
  endAll,
  outcomeText,
  query,
  urlFor,
} from './support/live';
import type { Outcome, Row } from './support/live';
import { loadSeam } from './support/seam';
import type { Seam } from './support/seam';
import { probes } from './probes/index';
import type { Client } from 'pg';

/* ────────────────────────────── what the contract fixes ────────────────────────────── */

/** The journey and the page object the test contract names (C-05). */
const JOURNEY = ['tests', 'e2e', 'j-001-auth.spec.ts'];
const PAGE_OBJECT = ['tests', 'e2e', 'pages', 'auth.ts'];

/** The Design Decision the screens are graded against (R-UI, S-Auth). */
const DESIGN_DOC = ['docs', 'design', 's-auth.md'];

/** AC-6: the two baselined screens, under tests/e2e/baselines/auth/. */
const BASELINES = ['sign-up.png', 'sign-in.png'];
const BASELINE_DIR = ['tests', 'e2e', 'baselines', 'auth'];

/** C-05's test ids for S-Auth. The journey speaks to the screens through these names. */
const TESTIDS: readonly string[] = [
  'auth-email',
  'auth-password',
  'auth-submit',
  'auth-error',
  'auth-notice',
  'tenant-home',
  'session-row',
  'session-revoke',
  'auth-sign-out',
];

/** C-05's public auth routes. The journey has to open each of them to reach its checkpoints. */
const ROUTES: readonly string[] = ['/sign-up', '/sign-in', '/magic-link', '/reset-password'];

/**
 * J-001's checkpoints, named as the increment's spec names them. "Journey segments … with
 * named checkpoints" is the contract; a journey that quietly drops one is a journey whose
 * green says less than it looks like it says.
 */
const CHECKPOINTS: readonly string[] = [
  'sign-up',
  'check-email',
  'verified-landing',
  'sign-in',
  'magic-link',
  'reset',
  'sessions',
];

/** AC-5: the marker the current device's row carries, so the journey can revoke the other. */
const CURRENT_ROW_MARKER = 'data-current';

/** AC-6: "each call expectNoAxeViolations (tests/e2e/axe.ts, unfiltered)". */
const AXE_HELPER = 'expectNoAxeViolations';

/**
 * The ways a journey narrows axe instead of calling the lane's helper. tests/e2e/axe.ts is
 * the one builder, on purpose: "a helper every checkpoint calls is a helper that can be
 * proved to fire, and twelve hand-rolled builders cannot be."
 */
const AXE_NARROWINGS: readonly string[] = ['AxeBuilder', 'withTags', 'disableRules', 'exclude('];

/** The mail seam's kinds — the whole of `kind ∈ {…}` in the test contract. */
const MAIL_KINDS: readonly string[] = ['verify', 'magic-link', 'reset'];

/** AC-2 / the test contract: the tables 0001_spine_auth.sql founds. */
const SPINE_TABLES: readonly string[] = [
  'users',
  'sessions',
  'accounts',
  'verifications',
  'tenant_memberships',
  'auth_mail_outbox',
];

const MIGRATION = ['db', 'migrations', '0001_spine_auth.sql'];
const PROBE_FILE = ['db', '__tests__', 'probes', 'spine.ts'];
const TENANCY_MODULE = 'src/server/tenancy.ts';
const AUTH_MODULE = 'src/server/auth.ts';

/**
 * AC-6: "'/' , smoke.spec.ts and baselines/smoke/** are byte-identical to their state before
 * this increment". Byte-identity is the criterion, so it is pinned by content: these are the
 * git blob hashes at `git merge-base HEAD main` (0aff458), read with `git hash-object`, which
 * hashes content and nothing about the branch it was read from. Pinning the blob rather than
 * a diff against a ref keeps the assertion working in a checkout that has no `main`.
 */
const J000_SURFACE: readonly (readonly [string, string])[] = [
  ['src/app/page.tsx', 'f161ea7c15ab2336aea93fc267b30c4a03acccb8'],
  ['tests/e2e/smoke.spec.ts', '6e981629a00699bc44f3f3cad405e1809842cc03'],
  ['tests/e2e/baselines/smoke/root.png', '57477aecff7c949ada200052d24eec346b12b690'],
];

/** The lane's success line, exactly as scripts/e2e.mjs says it. */
const LANE_OK = /^e2e: ok \(\d+(\.\d+)?s\)$/;

/** PNG's magic bytes — a baseline that is not a PNG is not a baseline. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** `pnpm e2e --journey J-001` builds Next, provisions a database and drives a browser. */
const LANE_BUDGET_MS = 900_000;

/** The e2e lane's own database and build output, which this file reads after the lane ran. */
const E2E_DB = (() => {
  const name = process.env['CUBIT_E2E_DB'];
  return name === undefined || name.trim() === '' ? 'cubit_e2e' : name;
})();
const E2E_DIST = '.next-e2e';

/** Q-12 / the test contract: "up to 20 consecutive POSTs … must include ≥ 1 HTTP 429". */
const RATE_LIMIT_ATTEMPTS = 20;
const SIGN_IN_ENDPOINT = '/api/auth/sign-in/email';
const TOO_MANY_REQUESTS = 429;

/**
 * better-auth's magic-link endpoint, mounted under the `/api/auth/[...all]` handler the test
 * contract fixes. The plugin is the bundled `better-auth/plugins` one at the pinned 1.7.1, so
 * the path is the library's, not one builder's invention.
 */
const MAGIC_LINK_ENDPOINT = '/api/auth/sign-in/magic-link';

/* ─────────────────────────────────── small helpers ─────────────────────────────────── */

const at = (...parts: string[]): string => join(REPO, ...parts);
const there = (...parts: string[]): boolean => existsSync(at(...parts));
const read = (...parts: string[]): string => readFileSync(at(...parts), 'utf8');

const open: Client[] = [];

/** The seam holds a pool of its own; a suite that left it open would never exit. */
let seam: Seam | undefined;

afterAll(async () => {
  await endAll(open);
  open.length = 0;
  if (seam !== undefined) {
    await seam.closeDb();
    seam = undefined;
  }
});

/**
 * A connection that can see the spine's rows.
 *
 * FORCEd row-level security binds the table owner too, so a raw connection with no
 * `cubit.scope` sees nothing whichever role it is. The app role under system scope is the
 * one the seed script and better-auth's own adapter use, so it is what the acceptance reads
 * through as well.
 */
async function systemClient(url?: string): Promise<Client> {
  const client = url === undefined ? await connectAs(APP_ROLE) : await connectTo(url);
  open.push(client);
  await client.query("select set_config('cubit.scope', 'system', false)");
  return client;
}

/** The owner, for the trigger the atomicity probe installs. Also unscoped-by-default. */
async function ownerClient(): Promise<Client> {
  const client = await connectAs(MIGRATE_ROLE);
  open.push(client);
  await client.query("select set_config('cubit.scope', 'system', false)");
  return client;
}

async function countOf(client: Client, table: string): Promise<number> {
  const rows = await query(client, `select count(*)::int as n from public."${table}"`);
  return Number(rows[0]?.['n'] ?? -1);
}

/**
 * A product module, loaded by an absolute path assembled at run time.
 *
 * A *literal* specifier is resolved while this file is transformed, so one `import
 * '../../src/server/tenancy'` would make vite fail the whole file and vitest would report
 * "0 test" — no failing assertion at all, on the very day the module does not exist yet.
 * Built at run time, a missing module is one named failure in one test.
 */
async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const path = at(...relative.split('/'));
  if (!existsSync(path)) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(path).href)) as Record<string, unknown>;
}

/** A port nobody is on, asked of the OS rather than guessed (C-07 keeps 3210/3211 taken). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => (port === 0 ? reject(new Error('no free port')) : resolve(port)));
    });
  });
}

/* ───────────────────────────────── SURFACE (fs + git) ───────────────────────────────── */

describe('inc-008 — the committed surface (AC-1, AC-3, AC-6)', () => {
  it('AC-6 / AC-1 (J-001, S-Auth): the journey, its page object, its two baselines and the Design Decision are committed — and J-000’s surface is byte-identical to its state before this increment', async () => {
    // AC-6 / C-05: the journey exists and its titles carry J-001, because
    // `pnpm e2e --journey J-001` is Playwright's --grep over the full title path — a spec
    // that never says J-001 is a journey nothing selects.
    expect(there(...JOURNEY), `${join(...JOURNEY)} is not in the tree`).toBe(true);
    const spec = read(...JOURNEY);
    expect(spec, 'the journey never names J-001, so --journey J-001 selects nothing').toContain(
      'J-001',
    );

    // C-05: the page object the contract fixes, with the mail-seam reader it must export.
    expect(there(...PAGE_OBJECT), `${join(...PAGE_OBJECT)} is not in the tree`).toBe(true);
    const pageObject = read(...PAGE_OBJECT);
    expect(
      pageObject,
      'tests/e2e/pages/auth.ts does not export latestMail — the test contract names it as the journey’s reader of the mail seam',
    ).toMatch(/export\s+(async\s+)?function\s+latestMail|export\s+const\s+latestMail/);

    // C-05: every route and every test id the contract fixes is spoken somewhere in the
    // journey or its page object. Which of the two says a given name is the Builder's
    // arrangement; that all of them are said is the contract.
    const surface = `${spec}\n${pageObject}`;
    for (const route of ROUTES) {
      expect(surface, `neither the journey nor its page object opens ${route}`).toContain(route);
    }
    for (const testid of TESTIDS) {
      expect(surface, `neither the journey nor its page object names ${testid}`).toContain(testid);
    }
    // AC-1 / the test contract: the active tenant is explicit in the session payload, and
    // the journey reads it back from the endpoint the contract names.
    expect(surface, 'the journey never reads activeTenantSlug back out of the session').toContain(
      'activeTenantSlug',
    );
    expect(surface, 'the journey never calls /api/auth/get-session').toContain(
      '/api/auth/get-session',
    );

    // J-001's checkpoints, each named in the journey — the segments the increment's spec
    // lists, from `sign-up` through `sessions`.
    for (const checkpoint of CHECKPOINTS) {
      expect(
        surface,
        `the journey names no “${checkpoint}” checkpoint; J-001's segments are [${CHECKPOINTS.join(', ')}]`,
      ).toContain(checkpoint);
    }

    // AC-5: the current device's row is marked, which is how the journey knows which row to
    // revoke and which one is its own.
    expect(surface, `the journey never reads ${CURRENT_ROW_MARKER} off a session row`).toContain(
      CURRENT_ROW_MARKER,
    );

    // AC-6: "J-001 checkpoints each call expectNoAxeViolations (tests/e2e/axe.ts,
    // unfiltered)" — the lane's one helper, and no rule set narrowed on the way past it.
    expect(surface, `the journey never calls ${AXE_HELPER}`).toContain(AXE_HELPER);
    for (const narrowing of AXE_NARROWINGS) {
      expect(
        surface,
        `the journey narrows axe with “${narrowing}”; AC-6 says unfiltered, through tests/e2e/axe.ts`,
      ).not.toContain(narrowing);
    }

    // AC-6: the two baselines are the journey's own comparisons, not orphan files.
    for (const name of BASELINES) {
      expect(spec, `the journey never compares against the baseline ${name}`).toContain(name);
    }

    // AC-6: the two committed Linux baselines, under the directory the array-form snapshot
    // name ['auth', '<name>.png'] lands in. `updateSnapshots: 'none'` means a missing
    // baseline fails the lane rather than being written by it.
    for (const name of BASELINES) {
      const baseline = [...BASELINE_DIR, name];
      expect(there(...baseline), `${join(...baseline)} is not in the tree`).toBe(true);
      const bytes = readFileSync(at(...baseline));
      expect(bytes.length, `${join(...baseline)} is empty`).toBeGreaterThan(0);
      expect(
        bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC),
        `${join(...baseline)} is not a PNG`,
      ).toBe(true);
    }

    // AC-6: the Design Decision the screens are built against is committed.
    expect(there(...DESIGN_DOC), `${join(...DESIGN_DOC)} is not in the tree`).toBe(true);

    // Design Decision Interpretation 5 / risk note (5): a skeleton above the guard streams
    // the tenant shell past the redirect, so no loading.tsx may exist anywhere under /t.
    // Stated as the rule ("none, at any depth"), not as a list of the files that exist today.
    const tenantRoot = at('src', 'app', 't');
    if (existsSync(tenantRoot)) {
      const loaders = await run('git', ['ls-files', '--', 'src/app/t/**/loading.tsx']);
      expect(
        loaders.stdout.trim(),
        'a loading.tsx under src/app/t streams the tenant shell past the guard (AC-7’s redirect would answer 200 + shell)',
      ).toBe('');
    }

    // AC-6: J-000's surface, byte for byte. `git hash-object` hashes content, so this holds
    // in any checkout and says exactly what the criterion says.
    for (const [path, blob] of J000_SURFACE) {
      const hashed = await run('git', ['hash-object', '--', path]);
      expect(hashed.stdout.trim(), `${path} is no longer byte-identical (AC-6 forbids it)`).toBe(
        blob,
      );
    }
    // …and nothing was added beside them: baselines/smoke/** is the whole directory.
    const pinnedSmoke = new Set(
      J000_SURFACE.map(([path]) => path).filter((path) =>
        path.startsWith('tests/e2e/baselines/smoke/'),
      ),
    );
    for (const entry of readdirSync(at('tests', 'e2e', 'baselines', 'smoke'))) {
      expect(
        pinnedSmoke.has(`tests/e2e/baselines/smoke/${entry}`),
        `tests/e2e/baselines/smoke/${entry} was added by this increment; AC-6 leaves that directory alone`,
      ).toBe(true);
    }
  });
});

/* ───────────────────────────── SEAM (the migrated scratch DB) ───────────────────────────── */

describe('inc-008 — the spine’s tables and the personal-tenant mint (AC-2)', () => {
  it('AC-2 (R-SPINE-002, Q-02): 0001_spine_auth.sql founds the six spine tables, tenant_memberships carries tenant_id, and the table is registered as a probe', async () => {
    // AC-2: the migration is committed under the name the test contract fixes.
    expect(there(...MIGRATION), `${join(...MIGRATION)} is not in the tree`).toBe(true);

    // AC-2: and the database `pnpm test:db` just migrated really has the tables. to_regclass
    // answers from the catalogue rather than from information_schema, so the answer does not
    // depend on which privileges the reading role happens to hold.
    const owner = await ownerClient();
    for (const table of SPINE_TABLES) {
      const found = await query(owner, 'select to_regclass($1) as reg', [`public.${table}`]);
      expect(
        found[0]?.['reg'],
        `public.${table} does not exist after this tree's migrations ran`,
      ).not.toBeNull();
    }

    // AC-2 / risk note (3): tenant_memberships carries the column the RLS policies scope on.
    const scoped = await query(
      owner,
      'select column_name from information_schema.columns where table_schema = $1 and table_name = $2 and column_name = $3',
      ['public', 'tenant_memberships', 'tenant_id'],
    );
    expect(
      scoped.length,
      'tenant_memberships has no tenant_id column — the RLS enumeration has nothing to scope on',
    ).toBe(1);

    // AC-2: "registered in db/__tests__/probes/spine.ts so rls-enumeration stays green". The
    // registry is read the way rls-enumeration reads it, so this passes on the same evidence.
    expect(there(...PROBE_FILE), `${join(...PROBE_FILE)} is not in the tree`).toBe(true);
    const registered = await probes();
    expect(
      [...registered.keys()].includes('tenant_memberships'),
      `tenant_memberships is not registered as a probe; the registry holds [${[...registered.keys()].join(', ')}]`,
    ).toBe(true);
  });

  it('AC-2 (R-SPINE-002): createUserWithPersonalTenant is exported from src/server/tenancy.ts, takes an injected handle, and returns a user, a personal tenant and the membership joining them', async () => {
    // AC-2: the interface the spec fixes, loaded by name. `src/server/auth.ts` is asserted
    // here too because the same criterion names it as the increment's other seam export.
    expect(there('src', 'server', 'auth.ts'), `${AUTH_MODULE} is not in the tree`).toBe(true);
    const tenancy = await importProduct(TENANCY_MODULE);
    const mint = tenancy['createUserWithPersonalTenant'];
    expect(
      typeof mint,
      `${TENANCY_MODULE} does not export createUserWithPersonalTenant (it exports [${Object.keys(tenancy).join(', ')}])`,
    ).toBe('function');
    const create = mint as (db: unknown, input: unknown) => Promise<Record<string, unknown>>;

    const reader = await systemClient();
    const before = {
      users: await countOf(reader, 'users'),
      tenants: await countOf(reader, 'tenants'),
      memberships: await countOf(reader, 'tenant_memberships'),
    };

    const { handle, transactions } = await injectedHandle();
    const email = `inc008-mint-${Date.now()}@example.test`;
    const minted = await create(handle, { email, name: 'inc-008 mint', password: 'inc008-Passw0rd!' });

    // AC-2: "returns { userId, tenantId, slug }".
    for (const key of ['userId', 'tenantId', 'slug']) {
      expect(
        typeof minted[key],
        `the returned record has no ${key}: ${JSON.stringify(minted)}`,
      ).toBe('string');
    }

    // AC-2: "db accepts any handle with the seam's transaction shape" — the mint ran through
    // the handle it was given, and it opened a transaction on it.
    expect(
      transactions.count,
      'createUserWithPersonalTenant never opened a transaction on the handle it was given',
    ).toBeGreaterThan(0);

    // AC-2: one user, one personal tenant, one membership joining them — read back through a
    // connection of the acceptance's own, so the claim is about committed rows.
    const userId = String(minted['userId']);
    const tenantId = String(minted['tenantId']);
    const users = await query(reader, 'select id from public.users where id = $1', [userId]);
    expect(users.length, `no users row was committed for ${userId}`).toBe(1);
    const tenants = await query(reader, 'select slug from public.tenants where id = $1', [tenantId]);
    expect(tenants.length, `no tenants row was committed for ${tenantId}`).toBe(1);
    expect(tenants[0]?.['slug'], 'the returned slug is not the personal tenant’s slug').toBe(
      minted['slug'],
    );
    const memberships = await query(
      reader,
      'select tenant_id from public.tenant_memberships where tenant_id = $1',
      [tenantId],
    );
    expect(
      memberships.length,
      'no tenant_memberships row joins the new user to its personal tenant',
    ).toBeGreaterThan(0);

    // Each of the three tables grew by exactly the mint. Counted rather than named, so the
    // claim does not depend on how the columns are spelled.
    expect(await countOf(reader, 'users'), 'the mint did not add exactly one user').toBe(
      before.users + 1,
    );
    expect(await countOf(reader, 'tenants'), 'the mint did not add exactly one tenant').toBe(
      before.tenants + 1,
    );
    expect(
      await countOf(reader, 'tenant_memberships'),
      'the mint did not add exactly one membership',
    ).toBe(before.memberships + 1);
  });

  it('AC-2 (R-SPINE-002): the mint is one transaction — a write it cannot make leaves no user, no tenant and no membership behind', async () => {
    const tenancy = await importProduct(TENANCY_MODULE);
    const create = tenancy['createUserWithPersonalTenant'] as (
      db: unknown,
      input: unknown,
    ) => Promise<unknown>;
    expect(typeof create, `${TENANCY_MODULE} does not export createUserWithPersonalTenant`).toBe(
      'function',
    );

    const reader = await systemClient();
    const owner = await ownerClient();

    // The refusal is installed in the *database*, on one table at a time, rather than in a
    // hand-written handle that intercepts statements: a trigger refuses the write however
    // the mint spells it and whatever order it writes in, so the proof does not depend on
    // reading src/server/tenancy.ts. Both tables are tried, so "the user is written first
    // and the tenant second" cannot make the claim vacuous.
    for (const blocked of ['tenants', 'tenant_memberships']) {
      const before = {
        users: await countOf(reader, 'users'),
        tenants: await countOf(reader, 'tenants'),
        memberships: await countOf(reader, 'tenant_memberships'),
      };

      await refuseInsertsOn(owner, blocked);
      let outcome: Outcome = { ok: false, error: new Error('the mint was never called') };
      try {
        const { handle } = await injectedHandle();
        outcome = await attempt(() =>
          create(handle, {
            email: `inc008-atomic-${blocked}-${Date.now()}@example.test`,
            name: 'inc-008 atomicity',
            password: 'inc008-Passw0rd!',
          }),
        );
      } finally {
        await allowInsertsOn(owner, blocked);
      }

      // AC-2: the mint cannot report success when part of it could not be written.
      expect(
        outcome.ok,
        `the ${blocked} insert was refused by the database, yet createUserWithPersonalTenant resolved: ${outcomeText(outcome)}`,
      ).toBe(false);

      // AC-2: "in one seam transaction" — nothing of the mint survives the refusal.
      expect(
        await countOf(reader, 'users'),
        `a users row persisted after the ${blocked} write was refused — the mint is not one transaction`,
      ).toBe(before.users);
      expect(
        await countOf(reader, 'tenants'),
        `a tenants row persisted after the ${blocked} write was refused`,
      ).toBe(before.tenants);
      expect(
        await countOf(reader, 'tenant_memberships'),
        `a tenant_memberships row persisted after the ${blocked} write was refused`,
      ).toBe(before.memberships);
    }
  });
});

/**
 * A handle with the seam's transaction shape, wrapping the seam's own system handle.
 *
 * The contract says `createUserWithPersonalTenant(db, input)` "accepts any handle with the
 * seam's transaction shape so a V-DB test can inject one". So the acceptance injects one: a
 * Proxy that forwards every property to a real `runAsSystem` handle — nothing about the
 * handle is narrowed — and counts the transactions opened through it. A mint that ignored
 * its `db` argument and reached for the seam itself would leave the counter at zero.
 */
async function injectedHandle(): Promise<{ handle: unknown; transactions: { count: number } }> {
  seam ??= await loadSeam();
  const system = (await Promise.resolve(
    seam.runAsSystem('inc-008 acceptance: the personal-tenant mint'),
  )) as unknown as object;
  const transactions = { count: 0 };
  // `target` is passed as the receiver, not the proxy: a getter on a driver object that
  // reads a private field would throw if `this` were the proxy.
  const handle = new Proxy(system, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== 'function') return value;
      const method = value as (...args: unknown[]) => unknown;
      if (property !== 'transaction') return method.bind(target);
      return (...args: unknown[]): unknown => {
        transactions.count += 1;
        return method.apply(target, args);
      };
    },
  });
  return { handle, transactions };
}

/** Every insert on the table is refused, from inside the database. */
async function refuseInsertsOn(owner: Client, table: string): Promise<void> {
  await owner.query(
    `create or replace function public.inc008_refuse_${table}() returns trigger language plpgsql as $fn$
     begin raise exception 'inc-008 acceptance: the ${table} write is refused' using errcode = 'P0001'; end $fn$`,
  );
  await owner.query(`drop trigger if exists inc008_refuse_${table} on public."${table}"`);
  await owner.query(
    `create trigger inc008_refuse_${table} before insert on public."${table}"
     for each row execute function public.inc008_refuse_${table}()`,
  );
}

async function allowInsertsOn(owner: Client, table: string): Promise<void> {
  await owner.query(`drop trigger if exists inc008_refuse_${table} on public."${table}"`);
  await owner.query(`drop function if exists public.inc008_refuse_${table}()`);
}

/* ────────────────────────────────────── LANE ────────────────────────────────────── */

/**
 * The lane, run once for every claim that reads it: a build, a cold database, migrations and
 * the seed, and the journey this node's gate line names.
 *
 * A `beforeAll` that threw would report its tests as skipped rather than failed, so the run
 * is memoised into a promise each test awaits: a lane that cannot start fails every test
 * that needs it, by name.
 *
 * AC-6 names the composite invocation `pnpm e2e --journey J-001 --journey J-000`. The runner
 * keeps the *last* `--journey` it is given (scripts/e2e.mjs `parseArgs`, and scripts/** is
 * out of this increment's scope), so that command runs J-000 alone and would be green
 * whatever this increment did to J-001. This file therefore runs the two halves separately:
 * the lane on J-000 here, and J-001 itself in `journeyRun()` below — strictly stronger than
 * the composite, because both halves are asserted rather than one.
 *
 * AM-04 / AM-05 (arbitration, 2026-08-24, TEST_AMENDED): J-001's two `toHaveScreenshot`
 * checkpoints compare against `tests/e2e/baselines/auth/sign-{up,in}.png`, captured from the
 * superseded v1 paint (cobalt accent, Inter / JetBrains Mono). Those baselines are inc-018's
 * to regenerate; until they land, a screenshot comparison here would assert the design the
 * Bible now forbids — and, because the sign-up comparison is the first statement of its test,
 * it would also take the functional evidence (users, memberships, mail, sessions) down with
 * it. So J-001 is run with Playwright's own `--ignore-snapshots`: every functional and axe
 * assertion of the journey runs and is asserted; the snapshot comparisons are the only thing
 * left out, and they belong to a node that owns those pixels.
 */
const GATE_JOURNEY = 'J-000';
const LANE_JOURNEY = 'J-001';

let laneOnce: Promise<Ran> | undefined;
function laneRun(): Promise<Ran> {
  laneOnce ??= run('pnpm', ['run', 'e2e', '--journey', GATE_JOURNEY]);
  return laneOnce;
}

/**
 * J-001 itself, against the build the lane produced and the cold database it left seeded,
 * served by `servedApp()`. Playwright is invoked through the same config and the same pinned
 * binary the lane uses (scripts/e2e.mjs); `--ignore-snapshots` is the runner's own switch for
 * "run the test, skip its snapshot comparisons", so no assertion is rewritten to say less.
 *
 * DATABASE_URL is the lane's scratch database: tests/e2e/pages/auth.ts reads the mail outbox
 * through it, and E2E_PORT is what playwright.config.ts builds its baseURL from.
 */
let journeyOnce: Promise<Ran> | undefined;
function journeyRun(): Promise<Ran> {
  journeyOnce ??= (async () => {
    const { port } = await servedApp();
    return run(
      at('node_modules', '.bin', 'playwright'),
      ['test', '--config', 'playwright.config.ts', '--grep', LANE_JOURNEY, '--ignore-snapshots'],
      {
        env: {
          DATABASE_URL: urlFor(E2E_DB, APP_ROLE),
          CUBIT_E2E_DB: E2E_DB,
          NEXT_DIST_DIR: E2E_DIST,
          E2E_PORT: String(port),
          FONTCONFIG_FILE: at('tests', 'e2e', 'setup', 'fonts.conf'),
          FORCE_COLOR: '0',
        },
      },
    );
  })();
  return journeyOnce;
}

/**
 * The build that lane produced, served once for the probes that need an app rather than a
 * row. The lane leaves `.next-e2e` and a migrated, seeded database behind it, so this costs a
 * `next start` and nothing else — a second `next build` would prove nothing and take minutes.
 */
let servedOnce: Promise<{ port: number; stop: () => Promise<void> }> | undefined;
function servedApp(): Promise<{ port: number; stop: () => Promise<void> }> {
  servedOnce ??= (async () => {
    await laneRun();
    if (!existsSync(at(E2E_DIST))) {
      throw new Error(
        `${E2E_DIST} is not in the tree — \`pnpm e2e --journey ${GATE_JOURNEY}\` did not get as far as a build`,
      );
    }
    const port = await freePort();
    return { port, stop: await serveBuild(port) };
  })();
  return servedOnce;
}

afterAll(async () => {
  if (servedOnce === undefined) return;
  try {
    await (await servedOnce).stop();
  } catch {
    /* it never came up; the failing tests already say why */
  }
});

describe('inc-008 — the journey lane and the rate limit (AC-1, AC-3, AC-4, AC-5, AC-6)', () => {
  it(
    'AC-6 (V-E2E, C-09): the lane exits 0 and says so, J-001 passes against the build it left, and the cold database shows every user minted into a personal tenant and all three kinds of auth mail sent',
    async (ctx) => {
      // A nested `pnpm test:db` must not spawn a lane of its own (support/lanes.ts).
      if (isNested()) ctx.skip();
      const ran = await laneRun();

      expect(
        ran.code,
        `pnpm e2e --journey ${GATE_JOURNEY} exited ${ran.code}\n${tail(ran.merged)}`,
      ).toBe(0);
      // The contract line is on stdout; the build, the migrations and Playwright's report
      // are detail on stderr.
      expect(lastLine(ran.stdout), tail(ran.merged)).toMatch(LANE_OK);

      // AM-04 / AM-05: J-001's own assertions — functional and axe, its snapshot comparisons
      // deferred to inc-018's re-baseline — against the build and the seeded database the
      // lane left behind. Everything below reads the rows this run produced.
      const journey = await journeyRun();
      expect(
        journey.code,
        `J-001 exited ${journey.code} (snapshots ignored)\n${tail(journey.merged)}`,
      ).toBe(0);

      // The journey ran against a cold database the lane made, migrated and seeded, and it
      // is still there afterwards. What it holds is the evidence for AC-1, AC-3 and AC-4:
      // rows a passing journey could not have produced any other way.
      const e2e = await systemClient(urlFor(E2E_DB, APP_ROLE));

      // AC-1 / AC-3: the journey signed real users up.
      const users = await query(e2e, 'select id from public.users');
      expect(users.length, 'the J-001 run left no users behind — did the journey sign anyone up?')
        .toBeGreaterThan(0);

      // AC-2 / R-SPINE-002: "after the J-001 run every users row has a membership in a
      // personal tenant". The joining column is discovered from the foreign key rather than
      // guessed, so the claim is about the shape the migration declares.
      const link = await membershipUserColumn(e2e);
      const orphans = await query(
        e2e,
        `select u.id from public.users u
          where not exists (select 1 from public.tenant_memberships m where m."${link}" = u.id)`,
      );
      expect(
        orphans.map((row) => String(row['id'])),
        'these users have no tenant membership — every sign-up mints a personal tenant (R-SPINE-002)',
      ).toEqual([]);

      // AC-1 / AC-3 / AC-4: verification, magic link and reset all went through the mail
      // seam. The set is the contract's whole `kind ∈ {…}`; a later increment adding a
      // fourth kind does not redden this.
      const kinds = await query(e2e, 'select distinct kind from public.auth_mail_outbox');
      const sent = new Set(kinds.map((row) => String(row['kind'])));
      for (const kind of MAIL_KINDS) {
        expect(
          sent.has(kind),
          `no auth_mail_outbox row of kind '${kind}' — the journey has [${[...sent].join(', ')}]`,
        ).toBe(true);
      }

      // AC-5: the journey signed in from two contexts and revoked one, so the sessions table
      // is a table the run actually used.
      expect(
        await countOf(e2e, 'sessions'),
        'the J-001 run left no sessions behind — nobody was ever signed in',
      ).toBeGreaterThan(0);
    },
    LANE_BUDGET_MS,
  );

  it(
    'AC-3 (R-SPINE-001): a magic-link request for an address with no account is answered, and mints neither a user nor a personal tenant',
    async (ctx) => {
      if (isNested()) ctx.skip();
      // Deliberately before the rate-limit probe: that one spends the sign-in budget on
      // purpose, and a limiter that also covers this path would make the claim vacuous.
      const { port } = await servedApp();
      const e2e = await systemClient(urlFor(E2E_DB, APP_ROLE));
      const before = {
        users: await countOf(e2e, 'users'),
        tenants: await countOf(e2e, 'tenants'),
      };

      const response = await fetch(`http://127.0.0.1:${port}${MAGIC_LINK_ENDPOINT}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: `inc008-no-such-account-${Date.now()}@example.test`,
          callbackURL: '/',
        }),
        redirect: 'manual',
      });
      const said = await response.text();

      // The endpoint has to exist for "it minted nothing" to mean anything: a 404 mints
      // nothing either. Which non-404 status it answers with is the product's business —
      // the design decision's notice is deliberately existence-neutral.
      expect(
        [404, 405].includes(response.status),
        `POST ${MAGIC_LINK_ENDPOINT} answered HTTP ${response.status}: ${said.slice(0, 200)}`,
      ).toBe(false);

      // AC-3: "A magic-link request for an email with no account does not create a user (no
      // personal tenant is minted for it)" — risk note (4), better-auth's disableSignUp.
      expect(
        await countOf(e2e, 'users'),
        'a magic-link request for an address with no account minted a user',
      ).toBe(before.users);
      expect(
        await countOf(e2e, 'tenants'),
        'a magic-link request for an address with no account minted a tenant',
      ).toBe(before.tenants);
    },
    LANE_BUDGET_MS,
  );

  it(
    `AC-6 / Q-12: within ${RATE_LIMIT_ATTEMPTS} consecutive wrong-password POSTs to ${SIGN_IN_ENDPOINT}, at least one answers HTTP ${TOO_MANY_REQUESTS}`,
    async (ctx) => {
      if (isNested()) ctx.skip();
      const { port } = await servedApp();

      const statuses: number[] = [];
      for (let attemptNumber = 0; attemptNumber < RATE_LIMIT_ATTEMPTS; attemptNumber += 1) {
        const response = await fetch(`http://127.0.0.1:${port}${SIGN_IN_ENDPOINT}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'inc008-rate-limit@example.test',
            password: 'not-the-password',
          }),
          redirect: 'manual',
        });
        await response.text();
        statuses.push(response.status);
        if (response.status === TOO_MANY_REQUESTS) break;
      }

      // Q-12: "auth rate limits tested". One 429 inside the budget is the whole claim.
      expect(
        statuses.includes(TOO_MANY_REQUESTS),
        `${statuses.length} consecutive wrong-password sign-in attempts answered [${statuses.join(', ')}] and never ${TOO_MANY_REQUESTS}`,
      ).toBe(true);
    },
    LANE_BUDGET_MS,
  );
});

/** The last of a lane's output, which is where its reason for failing is. */
function tail(merged: string): string {
  return merged.split('\n').filter((line) => line.trim() !== '').slice(-40).join('\n');
}

/**
 * The foreign key from tenant_memberships to users, read from the catalogue. A membership
 * table has to join a user to a tenant; which word it uses for the user side is the
 * Builder's, and the constraint says it without anybody having to guess.
 */
async function membershipUserColumn(client: Client): Promise<string> {
  const rows: Row[] = await query(
    client,
    `select a.attname as column_name
       from pg_constraint c
       join lateral unnest(c.conkey) as k(attnum) on true
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where c.contype = 'f'
        and c.conrelid = 'public.tenant_memberships'::regclass
        and c.confrelid = 'public.users'::regclass`,
  );
  const found = rows[0]?.['column_name'];
  expect(
    typeof found,
    'tenant_memberships has no foreign key to users — nothing joins a membership to the member',
  ).toBe('string');
  return String(found);
}

/**
 * The build the e2e lane produced, served on a port of its own against the database that
 * lane migrated and seeded. Its own process group: `next start` is a parent, and killing the
 * pid alone can leave a worker holding the port.
 */
async function serveBuild(port: number): Promise<() => Promise<void>> {
  const server = spawn(
    join(REPO, 'node_modules', '.bin', 'next'),
    ['start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: REPO,
      env: {
        ...process.env,
        DATABASE_URL: urlFor(E2E_DB, APP_ROLE),
        NEXT_DIST_DIR: E2E_DIST,
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    },
  );
  let said = '';
  const collect = (chunk: Buffer): void => {
    said += chunk.toString('utf8');
  };
  server.stdout?.on('data', collect);
  server.stderr?.on('data', collect);

  const stop = async (): Promise<void> => {
    if (server.exitCode !== null || server.pid === undefined) return;
    await new Promise<void>((resolve) => {
      const hard = setTimeout(() => {
        try {
          process.kill(-(server.pid as number), 'SIGKILL');
        } catch {
          /* already gone */
        }
      }, 5_000);
      server.on('close', () => {
        clearTimeout(hard);
        resolve();
      });
      try {
        process.kill(-(server.pid as number), 'SIGTERM');
      } catch {
        clearTimeout(hard);
        resolve();
      }
    });
  };

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited ${server.exitCode} before it served:\n${said}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
      await response.text();
      if (response.status < 500) return stop;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  await stop();
  throw new Error(`the served build did not answer on ${port} within 120s:\n${said}`);
}
