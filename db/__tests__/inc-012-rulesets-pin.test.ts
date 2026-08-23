/**
 * inc-012 acceptance — the rule-set edition machinery and the pin made visible (AC-2, AC-3).
 *
 * R-SPINE-012, L-MEA-01, L-REG-07, J-003, B-07, SEAM-TENANT, C-SPINE-PROJECT.
 *
 * It lives under db/__tests__ because every claim below reaches a live database, and because
 * one of them builds and serves the app. `pnpm verify`'s vitest stage and CI both run without
 * a provisioned cluster, so a lane-spawning test in the root config would be red for a reason
 * that has nothing to do with the code under review — the reading inc-001 recorded and
 * inc-008/009/010/011 followed. Run it as
 *
 *     pnpm test:db db/__tests__/inc-012-rulesets-pin.test.ts
 *
 * A bare `pnpm vitest run db/__tests__/…` finds no tests: the root config excludes db/**.
 * AC-1 (the digest and the seed, both pure) is graded by `pnpm verify` instead, in
 * src/core/rulesets/__tests__/editions.test.ts.
 *
 * Three arms:
 *
 *   SURFACE + SCHEMA — the migration this increment owns, the two tables it founds, and the
 *   one thing L-REG-07 asks the schema itself to make impossible: an unpinned project. Read
 *   as consequences (a refused write), never as DDL text.
 *
 *   SEAM — `createPinnedProject` driven over SEAM-TENANT handles against tenants this file
 *   founds for itself, so no fixture is disturbed: the fork chain, its idempotence, and the
 *   single transaction (proved the only way a caller can prove one — roll it back and find
 *   that nothing survived).
 *
 *   SERVED — the tree built into `.next-e2e` and served on a free port against the database
 *   `pnpm test:db` provisioned, driven over HTTP with a session minted through the product's
 *   own door. R-UI-031 makes the URL the source of truth, so a fresh GET of the settings
 *   route is the right instrument for a server-rendered pane; nothing here needs a browser.
 *
 * ── Recorded readings ──────────────────────────────────────────────────────────────────
 *
 * R1. **`.next-e2e` is the only distDir a harness may build into.** `next build` appends
 *     `<distDir>/types/**` to `tsconfig.json` and reflows the file when the distDir is not
 *     already listed; `.next`, `.next-verify` and `.next-e2e` are listed precisely so no lane
 *     has anything to add, and `.next-e2e` is the one outside the lanes.
 *
 * R2. **The unit each parameter shows is the Design Decision's, read at run time.** AC-3 says
 *     each row shows "its unit" and names only `sft`; docs/design/s-project-settings.md §5 is
 *     where the other five live (and where `ratio` was decided for the seven dimensionless
 *     ones, because an empty cell is silence). The table is parsed rather than retyped, so
 *     the designer owns the words.
 *
 * R3. **The displayed value is the canonical string with en-IN grouping applied to its
 *     integer part** (§5 / Interpretation 4). The parse takes the displayed value from the
 *     same design table; the canonical value is that string with its grouping removed, which
 *     is what the seed pins and what AC-1 grades.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO } from './support/lanes';
import { APP_ROLE, attempt, describeError, outcomeText, sqlstates } from './support/live';
import type { Row } from './support/live';
import { createTenant, loadSeam, ready, rowsOf, sql } from './support/seam';
import type { ScopedHandle, Seam } from './support/seam';

/* ────────────────────────────── what the contract fixes ────────────────────────────── */

/** The Design Decision this pane is graded against, and the source of its units and copy. */
const DESIGN_DOC = ['docs', 'design', 's-project-settings.md'];

/** The migration this increment owns, and the journal that has to register it. */
const MIGRATION = ['db', 'migrations', '0003_spine_rulesets.sql'];
const MIGRATION_TAG = '0003_spine_rulesets';
const JOURNAL = ['db', 'migrations', 'meta', '_journal.json'];

/** The seam the fork is performed through. */
const SEED_MODULE = 'src/core/rulesets/seed';

/** The two tables, by their SQL names, and the columns the contract names on each. */
const EDITIONS_TABLE = 'rule_set_editions';
const PROJECTS_TABLE = 'projects';

const EDITION_COLUMNS: readonly string[] = [
  'id',
  'scope',
  'tenant_id',
  'parent_edition_id',
  'name',
  'version',
  'digest',
  'parameters',
  'methods',
  'created_at',
];

const PROJECT_COLUMNS: readonly string[] = [
  'id',
  'tenant_id',
  'name',
  'code',
  'rule_set_edition_id',
  'created_at',
];

/** The three scopes a fork chain passes through, in lineage order. */
const PLATFORM = 'platform';
const TENANT = 'tenant';
const PROJECT = 'project';

/** L-MEA-01's seed, by the name and version the version string spells. */
const SEED_NAME = 'IS1200_IN';
const SEED_VERSION = '2026.08';
const EDITION_KEY = `${SEED_NAME} @ ${SEED_VERSION}`;

/** The seventeen parameters, id → canonical decimal string (the test contract, verbatim). */
const SEED_PARAMETERS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['openingDeductionMinM2', '0.1'],
  ['memberEndNoDeductMaxCm2', '500'],
  ['embeddedDuctNoDeductMaxCm2', '100'],
  ['finishOpeningDeductionMinM2', '0.1'],
  ['finishMinOutlineArea', '0.2'],
  ['finishMaxOutlineArea', '20000'],
  ['scaleVerificationTolerance', '0.01'],
  ['scaleAnisotropyTolerance', '0.01'],
  ['earthworkWorkingAllowance', '1.5'],
  ['earthworkDepthExtra', '0.5'],
  ['blindingProjection', '3'],
  ['blindingThickness', '3'],
  ['placementContainmentMerge', '0.08'],
  ['placementNearAnchor', '0.9'],
  ['placementFootprintMin', '0.6'],
  ['placementFootprintMax', '2.5'],
  ['placementHumanSnap', '0.5'],
] as const);

const PARAMETER_IDS: readonly string[] = SEED_PARAMETERS.map(([id]) => id);

/** The one parameter L-MEA-01 writes with grouping, and the unit it is written in. */
const GROUPED_ID = 'finishMaxOutlineArea';
const GROUPED_DISPLAY = '20,000';
const GROUPED_UNIT = 'sft';

/** The test ids the contract fixes for the pane. */
const EDITION_ID = 'ruleset-edition';
const DIGEST_ID = 'ruleset-digest';
const LINEAGE_ID = 'ruleset-lineage';
const LINEAGE_ROWS: readonly string[] = [
  'ruleset-lineage-platform',
  'ruleset-lineage-tenant',
  'ruleset-lineage-project',
];
const PARAMS_ID = 'ruleset-params';
const paramId = (id: string): string => `ruleset-param-${id}`;

/** A digest, as the contract spells it. */
const HEX64 = /^[0-9a-f]{64}$/;

/** The refusals the database itself answers with. */
const NOT_NULL_VIOLATION = '23502';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';
const INVALID_TEXT_REPRESENTATION = '22P02';

/** R1: the one distDir a harness outside the lanes may build into. */
const DIST_DIR = '.next-e2e';

/** Long enough for better-auth's own minimum, and never a real person's. */
const PASSWORD = 'cubit-inc012-Passw0rd!';

/** The settings route, as the increment settled it. */
const rulesetPath = (slug: string, projectId: string): string =>
  `/t/${slug}/p/${projectId}/settings/ruleset`;

/* ────────────────────────────────── reading the tree ────────────────────────────────── */

const at = (...parts: string[]): string => join(REPO, ...parts);
const there = (...parts: string[]): boolean => existsSync(at(...parts));
const read = (...parts: string[]): string => readFileSync(at(...parts), 'utf8');

let seamOnce: Promise<Seam> | undefined;

async function seam(): Promise<Seam> {
  seamOnce ??= loadSeam();
  return seamOnce;
}

async function systemHandle(): Promise<ScopedHandle> {
  return ready((await seam()).runAsSystem('inc-012 acceptance: founding its own tenants'));
}

async function tenantHandle(tenantId: string): Promise<ScopedHandle> {
  return ready((await seam()).forTenant({ tenantId }));
}

afterAll(async () => {
  if (seamOnce !== undefined) {
    try {
      await (await seamOnce).closeDb();
    } catch {
      /* a pool that never opened has nothing to close */
    }
  }
  await stopServer();
});

/**
 * A product module, loaded by an absolute path assembled at run time.
 *
 * A *literal* specifier is resolved while this file is transformed, so one
 * `import '../../src/core/rulesets/seed'` would make vite fail the whole file and vitest would
 * report "0 test" — no failing assertion at all, on the very day the module does not exist.
 * Assembled at run time, a missing module is one named failure per test.
 */
async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const path = at(...relative.split('/'));
  // The file spellings first, and the bare path only when it is itself a file: a module that
  // is also a directory (`src/core/errors`) would otherwise be imported as the directory and
  // fail with "Cannot find module", which reads as a broken tree rather than a missing one.
  const candidates = [`${path}.ts`, `${path}.tsx`, join(path, 'index.ts'), path];
  const found = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  if (found === undefined) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(found).href)) as Record<string, unknown>;
}

interface Pinned {
  readonly projectId: string;
  readonly editionId: string;
  readonly digest: string;
}

type CreatePinnedProject = (
  handle: unknown,
  input: { tenantId: string; name: string; code: string },
) => Promise<Pinned>;

async function createPinnedProject(): Promise<CreatePinnedProject> {
  const module = await importProduct(SEED_MODULE);
  const exported = module['createPinnedProject'];
  expect(
    typeof exported,
    `${SEED_MODULE} exports no createPinnedProject function (AC-2)`,
  ).toBe('function');
  return exported as CreatePinnedProject;
}

/* ───────────────────────────── the decided units and values (R2, R3) ─────────────────── */

/** One markdown table under a `## <n>.` heading, as rows of cells. */
function tableRows(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    const cells = trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

function section(doc: string, from: number, to: number): string {
  const opened = doc.split(new RegExp(`^## ${String(from)}\\.`, 'm'))[1] ?? '';
  return opened.split(new RegExp(`^## ${String(to)}\\.`, 'm'))[0] ?? '';
}

interface DecidedRow {
  readonly id: string;
  /** The value as the pane displays it — grouped where the grouping rule bites (§5). */
  readonly display: string;
  readonly unit: string;
}

let decidedOnce: Map<string, DecidedRow> | undefined;

/** §5's table: the seventeen rows, by parameter id. The designer owns the units and the copy. */
function decidedRows(): Map<string, DecidedRow> {
  if (decidedOnce !== undefined) return decidedOnce;
  const found = new Map<string, DecidedRow>();
  for (const cells of tableRows(section(read(...DESIGN_DOC), 5, 6))) {
    const id = /`([^`]+)`/.exec(cells[1] ?? '')?.[1];
    const display = cells[2];
    const unit = cells[3];
    if (id === undefined || display === undefined || unit === undefined) continue;
    if (!PARAMETER_IDS.includes(id)) continue;
    found.set(id, { id, display, unit });
  }
  // The parse is an instrument, so it says when it broke rather than reporting a missing unit
  // as a defect in the pane.
  if (found.size !== PARAMETER_IDS.length) {
    throw new Error(
      `docs/design/s-project-settings.md §5 yielded ${String(found.size)} parameter rows, not ${String(PARAMETER_IDS.length)}`,
    );
  }
  decidedOnce = found;
  return found;
}

function decided(id: string): DecidedRow {
  const row = decidedRows().get(id);
  expect(row, `docs/design/s-project-settings.md §5 has no row for ${id}`).toBeDefined();
  return row ?? { id, display: '', unit: '' };
}

/* ────────────────────────────────── the served build ────────────────────────────────── */

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

function tail(said: string): string {
  return said.split('\n').filter((line) => line.trim() !== '').slice(-25).join('\n');
}

interface Ran {
  readonly code: number;
  readonly said: string;
}

function spawned(file: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<Ran> {
  return new Promise<Ran>((resolve) => {
    const child = spawn(file, [...args], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let said = '';
    const collect = (chunk: Buffer): void => {
      said += chunk.toString('utf8');
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.on('error', (error: Error) => resolve({ code: -1, said: `${said}${error.message}` }));
    child.on('close', (code) => resolve({ code: code ?? -1, said }));
  });
}

/** The database `pnpm test:db` provisioned for this run — the served build reads the same one. */
function appDatabaseUrl(): string {
  const url = process.env['DATABASE_URL'];
  return url === undefined || url.trim() === ''
    ? `postgres://${APP_ROLE}:${APP_ROLE}@127.0.0.1:5544/cubit_dev`
    : url;
}

let stopServer: () => Promise<void> = async () => undefined;
let servedOnce: Promise<number> | undefined;

/**
 * The tree, built once into `.next-e2e` (R1) and served once on a free port against the
 * database this run provisioned. One build and one `next start`, however many claims read it.
 */
function servedApp(): Promise<number> {
  servedOnce ??= (async () => {
    const built = await spawned(join(REPO, 'node_modules', '.bin', 'next'), ['build'], {
      ...process.env,
      NEXT_DIST_DIR: DIST_DIR,
      DATABASE_URL: appDatabaseUrl(),
      FORCE_COLOR: '0',
    });
    expect(built.code, `next build exited ${String(built.code)}:\n${tail(built.said)}`).toBe(0);

    const port = await freePort();
    const server = spawn(
      join(REPO, 'node_modules', '.bin', 'next'),
      ['start', '--hostname', '127.0.0.1', '--port', String(port)],
      {
        cwd: REPO,
        env: {
          ...process.env,
          NEXT_DIST_DIR: DIST_DIR,
          DATABASE_URL: appDatabaseUrl(),
          BETTER_AUTH_URL: `http://127.0.0.1:${String(port)}`,
          FORCE_COLOR: '0',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        // Its own process group: `next start` is a parent, and killing the pid alone can
        // leave a worker holding the port.
        detached: true,
      },
    );
    let said = '';
    const collect = (chunk: Buffer): void => {
      said += chunk.toString('utf8');
    };
    server.stdout?.on('data', collect);
    server.stderr?.on('data', collect);

    stopServer = async (): Promise<void> => {
      if (server.exitCode !== null || server.pid === undefined) return;
      const pid = server.pid;
      await new Promise<void>((resolve) => {
        const hard = setTimeout(() => {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {
            /* already gone */
          }
        }, 5_000);
        server.on('close', () => {
          clearTimeout(hard);
          resolve();
        });
        try {
          process.kill(-pid, 'SIGTERM');
        } catch {
          clearTimeout(hard);
          resolve();
        }
      });
    };

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) {
        throw new Error(`next start exited ${String(server.exitCode)} before it served:\n${tail(said)}`);
      }
      try {
        const answered = await fetch(`http://127.0.0.1:${String(port)}/`, { redirect: 'manual' });
        await answered.text();
        if (answered.status < 500) return port;
      } catch {
        /* not up yet */
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await stopServer();
    throw new Error(`the served build did not answer on ${String(port)} within 120s:\n${tail(said)}`);
  })();
  return servedOnce;
}

/* ──────────────────────────────── a session, over HTTP ──────────────────────────────── */

type Jar = Map<string, string>;

function absorb(response: Response, jar: Jar): void {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0] ?? '';
    const split = pair.indexOf('=');
    if (split <= 0) continue;
    jar.set(pair.slice(0, split).trim(), pair.slice(split + 1));
  }
}

const cookieHeader = (jar: Jar): string =>
  [...jar].map(([name, value]) => `${name}=${value}`).join('; ');

interface Answered {
  readonly status: number;
  readonly url: string;
  readonly body: string;
}

async function ask(url: string, jar: Jar): Promise<Answered> {
  let current = url;
  for (let hop = 0; hop < 8; hop += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: jar.size === 0 ? {} : { cookie: cookieHeader(jar) },
    });
    absorb(response, jar);
    const body = await response.text();
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || location === null) {
      return { status: response.status, url: current, body };
    }
    current = new URL(location, current).toString();
  }
  throw new Error(`more than 8 redirects from ${url}`);
}

async function post(url: string, body: unknown, jar: Jar): Promise<Answered> {
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      ...(jar.size === 0 ? {} : { cookie: cookieHeader(jar) }),
    },
    body: JSON.stringify(body),
  });
  absorb(response, jar);
  return { status: response.status, url, body: await response.text() };
}

/* ──────────────────────────────── reading served HTML ───────────────────────────────── */

/** Text as a reader sees it: React escapes apostrophes and angle brackets on the way out. */
function decodeEntities(html: string): string {
  return html
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

const carries = (html: string, testId: string): boolean =>
  html.includes(`data-testid="${testId}"`);

/** The inner HTML of the element carrying a test id, balanced over its own tag name. */
function elementAt(html: string, testId: string): string {
  const marker = `data-testid="${testId}"`;
  const found = html.indexOf(marker);
  if (found === -1) return '';
  const open = html.lastIndexOf('<', found);
  const tag = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(open, found))?.[1];
  const gt = html.indexOf('>', found);
  if (tag === undefined || gt === -1) return '';
  if (html[gt - 1] === '/') return '';

  const scanner = new RegExp(`<${tag}(?=[\\s/>])|</${tag}>`, 'g');
  scanner.lastIndex = gt + 1;
  let depth = 1;
  for (let match = scanner.exec(html); match !== null; match = scanner.exec(html)) {
    if (match[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) return html.slice(gt + 1, match.index);
    } else {
      depth += 1;
    }
  }
  return html.slice(gt + 1);
}

/** What a reader sees inside an element: tags gone, entities decoded, whitespace collapsed. */
function textOf(html: string, testId: string): string {
  return decodeEntities(elementAt(html, testId).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/* ─────────────────────────────── the tenants this file founds ───────────────────────── */

interface Forked {
  readonly tenantId: string;
  readonly first: Pinned;
  readonly second: Pinned;
}

let forkedOnce: Promise<Forked> | undefined;

/**
 * One tenant with two projects, both created through the seam (the declared fixture).
 *
 * Memoised into a promise each test awaits rather than built in `beforeAll`: a throwing
 * `beforeAll` reports its tests as skipped, and a skipped acceptance claim says nothing.
 */
function forked(): Promise<Forked> {
  forkedOnce ??= (async () => {
    const run = randomUUID().slice(0, 8);
    const system = await systemHandle();
    const tenantId = await createTenant(system, `inc012-${run}`);
    const create = await createPinnedProject();
    const handle = await tenantHandle(tenantId);
    const first = await create(handle, { tenantId, name: `Riverside ${run}`, code: `RV-${run}` });
    const second = await create(handle, { tenantId, name: `Hillside ${run}`, code: `HS-${run}` });
    return { tenantId, first, second };
  })();
  return forkedOnce;
}

/** Every edition row of a tenant's world, read under system scope. */
async function editionsOf(tenantId: string): Promise<Row[]> {
  const system = await systemHandle();
  return rowsOf(
    system,
    sql`select id, scope, tenant_id, parent_edition_id, name, version, digest
          from rule_set_editions where tenant_id = ${tenantId}`,
  ) as Promise<Row[]>;
}

async function editionById(id: string): Promise<Row | undefined> {
  const system = await systemHandle();
  const rows = await rowsOf(
    system,
    sql`select id, scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods
          from rule_set_editions where id = ${id}`,
  );
  return rows[0] as Row | undefined;
}

/* ═══════════════════════════════ SURFACE + SCHEMA (AC-2) ═══════════════════════════════ */

describe('AC-2 / L-REG-07 — the schema the fork lands in', () => {
  it('the migration this increment owns is committed and registered in the journal', () => {
    expect(there(...MIGRATION), `${join(...MIGRATION)} is not in the tree`).toBe(true);

    const journal = JSON.parse(read(...JOURNAL)) as { entries?: { tag?: string }[] };
    const tags = (journal.entries ?? []).map((entry) => String(entry.tag ?? ''));
    expect(tags, `_journal.json registers no ${MIGRATION_TAG} entry — it carries ${tags.join(', ')}`)
      .toContain(MIGRATION_TAG);
  });

  it('both tables exist on the cold database, carrying every column the contract names', async () => {
    const system = await systemHandle();
    const columnsOf = async (table: string): Promise<Map<string, Row>> => {
      const rows = await rowsOf(
        system,
        sql`select column_name, data_type, is_nullable
              from information_schema.columns
             where table_schema = 'public' and table_name = ${table}`,
      );
      return new Map(rows.map((row) => [String(row['column_name']), row as Row]));
    };

    const editions = await columnsOf(EDITIONS_TABLE);
    expect(editions.size, `${EDITIONS_TABLE} is not in the migrated database`).toBeGreaterThan(0);
    for (const column of EDITION_COLUMNS) {
      expect(editions.has(column), `${EDITIONS_TABLE} has no ${column} column`).toBe(true);
    }

    const projects = await columnsOf(PROJECTS_TABLE);
    expect(projects.size, `${PROJECTS_TABLE} is not in the migrated database`).toBeGreaterThan(0);
    for (const column of PROJECT_COLUMNS) {
      expect(projects.has(column), `${PROJECTS_TABLE} has no ${column} column`).toBe(true);
    }

    // L-REG-07: the pin is NOT NULL, which is what makes an unpinned project unrepresentable.
    expect(
      String(projects.get('rule_set_edition_id')?.['is_nullable']),
      'projects.rule_set_edition_id is nullable — an unpinned project is representable',
    ).toBe('NO');
    expect(
      String(projects.get('tenant_id')?.['is_nullable']),
      'projects.tenant_id is nullable',
    ).toBe('NO');
  });

  it('B-07: no column of either table is a float — parameters are exact, at rest', async () => {
    const system = await systemHandle();
    // The tables first: an empty float list means nothing if neither table is there.
    const present = await rowsOf(
      system,
      sql`select table_name, count(*)::int as columns
            from information_schema.columns
           where table_schema = 'public' and table_name in (${EDITIONS_TABLE}, ${PROJECTS_TABLE})
           group by table_name order by table_name`,
    );
    expect(
      present.map((row) => String(row['table_name'])),
      'a float column can only be ruled out on a table that exists',
    ).toEqual([EDITIONS_TABLE, PROJECTS_TABLE].sort());

    const floats = await rowsOf(
      system,
      sql`select table_name, column_name, data_type
            from information_schema.columns
           where table_schema = 'public'
             and table_name in (${EDITIONS_TABLE}, ${PROJECTS_TABLE})
             and data_type in ('double precision', 'real')`,
    );
    expect(
      floats.map((row) => `${String(row['table_name'])}.${String(row['column_name'])}`),
      'B-07: a float column would round a pinned parameter where nobody could see it',
    ).toEqual([]);
  });

  it('L-REG-07: the database itself refuses a project with no pin', async () => {
    const { tenantId, first } = await forked();
    const system = await systemHandle();

    const absent = await attempt(async () =>
      rowsOf(
        system,
        sql`insert into projects (tenant_id, name, code) values (${tenantId}, ${'Unpinned'}, ${`UP-${randomUUID().slice(0, 6)}`})`,
      ),
    );
    expect(
      absent.ok ? [] : sqlstates(absent.error),
      `an INSERT that named no rule-set edition was accepted — ${outcomeText(absent)}`,
    ).toContain(NOT_NULL_VIOLATION);

    const explicitNull = await attempt(async () =>
      rowsOf(
        system,
        sql`insert into projects (tenant_id, name, code, rule_set_edition_id)
             values (${tenantId}, ${'Unpinned'}, ${`UP-${randomUUID().slice(0, 6)}`}, NULL)`,
      ),
    );
    expect(
      explicitNull.ok ? [] : sqlstates(explicitNull.error),
      `an INSERT pinning NULL was accepted — ${outcomeText(explicitNull)}`,
    ).toContain(NOT_NULL_VIOLATION);

    // The control: the same INSERT with a real edition is accepted, so the refusals above
    // are about the missing pin and not about the statement.
    const pinned = await attempt(async () =>
      rowsOf(
        system,
        sql`insert into projects (tenant_id, name, code, rule_set_edition_id)
             values (${tenantId}, ${'Pinned control'}, ${`PC-${randomUUID().slice(0, 6)}`}, ${first.editionId})`,
      ),
    );
    expect(pinned.ok, `the control INSERT was refused: ${outcomeText(pinned)}`).toBe(true);
  });

  it('L-REG-07: the pin references an edition that exists', async () => {
    const { tenantId } = await forked();
    const system = await systemHandle();
    const refused = await attempt(async () =>
      rowsOf(
        system,
        sql`insert into projects (tenant_id, name, code, rule_set_edition_id)
             values (${tenantId}, ${'Dangling'}, ${`DG-${randomUUID().slice(0, 6)}`}, ${randomUUID()})`,
      ),
    );
    expect(
      refused.ok ? [] : sqlstates(refused.error),
      `a project pinned to an edition that does not exist was accepted — ${outcomeText(refused)}`,
    ).toContain(FOREIGN_KEY_VIOLATION);
  });

  it('L-MEA-01: scope is closed over platform, tenant and project', async () => {
    const { first } = await forked();
    const edition = await editionById(first.editionId);
    expect(edition, 'the returned edition id names no row').toBeDefined();
    const system = await systemHandle();

    const refused = await attempt(async () =>
      rowsOf(
        system,
        sql`insert into rule_set_editions (scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods)
             select ${'workspace'}, tenant_id, parent_edition_id, name, version,
                    overlay(digest placing ${'ff'} from 1), parameters, methods
               from rule_set_editions where id = ${first.editionId}`,
      ),
    );
    const states = refused.ok ? [] : sqlstates(refused.error);
    expect(
      states.some((state) => state === CHECK_VIOLATION || state === INVALID_TEXT_REPRESENTATION),
      `an edition scoped 'workspace' was accepted — ${outcomeText(refused)}`,
    ).toBe(true);
  });

  it('L-REG-07: a tenant or project edition with no tenant and no parent is refused', async () => {
    const { first } = await forked();
    const system = await systemHandle();

    const orphanTenant = await attempt(async () =>
      rowsOf(
        system,
        sql`insert into rule_set_editions (scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods)
             select scope, NULL, parent_edition_id, name, version,
                    overlay(digest placing ${'fe'} from 1), parameters, methods
               from rule_set_editions where id = ${first.editionId}`,
      ),
    );
    expect(
      orphanTenant.ok,
      `a ${PROJECT}-scope edition with tenant_id NULL was accepted — tenant_id is NULL only for ${PLATFORM} scope`,
    ).toBe(false);

    const orphanParent = await attempt(async () =>
      rowsOf(
        system,
        sql`insert into rule_set_editions (scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods)
             select scope, tenant_id, NULL, name, version,
                    overlay(digest placing ${'fd'} from 1), parameters, methods
               from rule_set_editions where id = ${first.editionId}`,
      ),
    );
    expect(
      orphanParent.ok,
      `a ${PROJECT}-scope edition with parent_edition_id NULL was accepted — a fork with no parent has no lineage`,
    ).toBe(false);
  });
});

/* ═══════════════════════════════════ SEAM (AC-2) ═══════════════════════════════════════ */

describe('AC-2 / R-SPINE-012, L-REG-07 — createPinnedProject forks platform → tenant → project', () => {
  it('returns the project, its edition and that edition’s digest', async () => {
    const { first } = await forked();
    expect(first.projectId, 'createPinnedProject returned no projectId').toMatch(
      /^[0-9a-f-]{36}$/i,
    );
    expect(first.editionId, 'createPinnedProject returned no editionId').toMatch(/^[0-9a-f-]{36}$/i);
    expect(first.digest, `createPinnedProject returned digest ${first.digest}`).toMatch(HEX64);

    const edition = await editionById(first.editionId);
    expect(String(edition?.['digest']), 'the returned digest is not the edition’s stored digest')
      .toBe(first.digest);
  });

  it('pins the project row it inserted to the edition it forked', async () => {
    const { tenantId, first } = await forked();
    const system = await systemHandle();
    const rows = await rowsOf(
      system,
      sql`select tenant_id, rule_set_edition_id from projects where id = ${first.projectId}`,
    );
    expect(rows.length, 'createPinnedProject inserted no projects row').toBe(1);
    expect(String(rows[0]?.['tenant_id']), 'the project belongs to another tenant').toBe(tenantId);
    expect(
      String(rows[0]?.['rule_set_edition_id']),
      'the project row is not pinned to the edition createPinnedProject returned',
    ).toBe(first.editionId);
  });

  it('the lineage is project → tenant → platform, and the platform seed is IS1200_IN @ 2026.08', async () => {
    const { tenantId, first } = await forked();

    const project = await editionById(first.editionId);
    expect(String(project?.['scope']), 'the pinned edition is not project-scope').toBe(PROJECT);
    expect(String(project?.['tenant_id']), 'the project edition belongs to another tenant').toBe(
      tenantId,
    );

    const templateId = String(project?.['parent_edition_id'] ?? '');
    expect(templateId, 'the project edition names no parent — nothing was forked').not.toBe('');
    const template = await editionById(templateId);
    expect(String(template?.['scope']), 'the project edition’s parent is not the tenant template')
      .toBe(TENANT);
    expect(String(template?.['tenant_id']), 'the tenant template belongs to another tenant').toBe(
      tenantId,
    );

    const platformId = String(template?.['parent_edition_id'] ?? '');
    expect(platformId, 'the tenant template names no parent — it forked nothing').not.toBe('');
    const platform = await editionById(platformId);
    expect(String(platform?.['scope']), 'the tenant template’s parent is not the platform seed')
      .toBe(PLATFORM);
    expect(platform?.['tenant_id'], 'the platform seed belongs to a tenant').toBeNull();
    expect(platform?.['parent_edition_id'], 'the platform seed was forked from something').toBeNull();
    expect(String(platform?.['name']), 'the platform seed is not L-MEA-01’s').toBe(SEED_NAME);
    expect(String(platform?.['version']), 'the platform seed is not the 2026.08 version').toBe(
      SEED_VERSION,
    );
  });

  it('is idempotent: a second project mints no second platform seed and no second template', async () => {
    const { tenantId, first, second } = await forked();
    const system = await systemHandle();

    expect(second.projectId, 'both calls returned the same project').not.toBe(first.projectId);
    expect(second.editionId, 'both projects share one project edition').not.toBe(first.editionId);

    const seeds = await rowsOf(
      system,
      sql`select id from rule_set_editions
           where scope = ${PLATFORM} and name = ${SEED_NAME} and version = ${SEED_VERSION}`,
    );
    expect(
      seeds.length,
      `${SEED_NAME} @ ${SEED_VERSION} was minted ${String(seeds.length)} times — the mint is not idempotent`,
    ).toBe(1);

    const templates = (await editionsOf(tenantId)).filter((row) => String(row['scope']) === TENANT);
    expect(
      templates.length,
      `the tenant holds ${String(templates.length)} templates — the fork is not idempotent`,
    ).toBe(1);

    const firstEdition = await editionById(first.editionId);
    const secondEdition = await editionById(second.editionId);
    expect(
      String(secondEdition?.['parent_edition_id']),
      'the two project editions were forked from different templates',
    ).toBe(String(firstEdition?.['parent_edition_id']));
  });

  it('L-REG-07: the whole fork is one transaction — rolled back, nothing of it survives', async () => {
    const run = randomUUID().slice(0, 8);
    const system = await systemHandle();
    const tenantId = await createTenant(system, `inc012-tx-${run}`);
    const create = await createPinnedProject();
    const handle = await tenantHandle(tenantId);
    const code = `TX-${run}`;
    const sentinel = `inc-012 rollback ${run}`;

    // The handle a later project-create increment will hand it: an open transaction. If the
    // fork opened one of its own and committed inside, the rows below would survive the throw.
    const rolled = await attempt(async () =>
      handle.transaction(async (tx) => {
        await create(tx, { tenantId, name: `Rolled ${run}`, code });
        throw new Error(sentinel);
      }),
    );
    expect(rolled.ok, 'the transaction did not roll back at all').toBe(false);
    expect(
      rolled.ok ? '' : describeError(rolled.error),
      'the rollback swallowed the caller’s own error',
    ).toContain(sentinel);

    const projects = await rowsOf(system, sql`select id from projects where code = ${code}`);
    expect(projects.length, 'a rolled-back project survived — the insert was outside the transaction')
      .toBe(0);
    const editions = await editionsOf(tenantId);
    expect(
      editions.length,
      'a rolled-back fork left editions behind — the fork is not one transaction',
    ).toBe(0);
  });
});

/* ═════════════════════════════════ SERVED (AC-3) ═══════════════════════════════════════ */

interface Reader {
  readonly jar: Jar;
  readonly slug: string;
  readonly port: number;
  readonly pinned: Pinned;
}

let readerOnce: Promise<Reader> | undefined;

/**
 * A signed-in member of a workspace with one pinned project, on the served build.
 *
 * The reader arrives through `/api/auth/sign-up/email` — the door a person uses, and the one
 * that mints their personal workspace (R-SPINE-002) — is verified in the database (the link
 * itself is J-001's claim, not this one's), signs in, and then has a project created through
 * the seam in this process against the same database the build is served from.
 */
function reader(): Promise<Reader> {
  readerOnce ??= (async () => {
    const port = await servedApp();
    const origin = `http://127.0.0.1:${String(port)}`;
    const run = randomUUID().slice(0, 8);
    const email = `inc012-${run}@example.test`;
    const jar: Jar = new Map();

    const signedUp = await post(`${origin}/api/auth/sign-up/email`, {
      email,
      password: PASSWORD,
      name: `inc012 ${run}`,
    }, jar);
    expect(
      signedUp.status,
      `POST /api/auth/sign-up/email answered ${String(signedUp.status)}: ${signedUp.body.slice(0, 300)}`,
    ).toBeLessThan(400);

    const system = await systemHandle();
    const users = await rowsOf(system, sql`select id from users where email = ${email}`);
    const userId = String(users[0]?.['id'] ?? '');
    expect(userId, 'sign-up wrote no user row').not.toBe('');
    await rowsOf(system, sql`update users set email_verified = true where id = ${userId}`);

    const memberships = await rowsOf(
      system,
      sql`select t.id, t.slug from tenants t
            join tenant_memberships m on m.tenant_id = t.id
           where m.user_id = ${userId}`,
    );
    expect(memberships.length, 'the reader holds no personal workspace').toBe(1);
    const tenantId = String(memberships[0]?.['id'] ?? '');
    const slug = String(memberships[0]?.['slug'] ?? '');

    const signedIn = await post(`${origin}/api/auth/sign-in/email`, { email, password: PASSWORD }, jar);
    expect(
      signedIn.status,
      `POST /api/auth/sign-in/email answered ${String(signedIn.status)}: ${signedIn.body.slice(0, 300)}`,
    ).toBeLessThan(400);
    expect(jar.size, 'signing in set no cookie').toBeGreaterThan(0);

    const create = await createPinnedProject();
    const handle = await tenantHandle(tenantId);
    const pinned = await create(handle, {
      tenantId,
      name: `Meghna Heights ${run}`,
      code: `MH-${run}`,
    });

    return { jar, slug, port, pinned };
  })();
  return readerOnce;
}

/** The pane, as the server sends it. One GET, many claims. */
let paneOnce: Promise<{ readonly html: string; readonly pinned: Pinned }> | undefined;

function pane(): Promise<{ readonly html: string; readonly pinned: Pinned }> {
  paneOnce ??= (async () => {
    const { jar, slug, port, pinned } = await reader();
    const path = rulesetPath(slug, pinned.projectId);
    const answered = await ask(`http://127.0.0.1:${String(port)}${path}`, jar);
    expect(
      answered.status,
      `GET ${path} answered ${String(answered.status)} at ${answered.url}`,
    ).toBe(200);
    return { html: answered.body, pinned };
  })();
  return paneOnce;
}

describe('AC-3 / R-SPINE-012, J-003 — the rule-set pin, in the HTML the server sends', () => {
  it('names the edition exactly as name @ version', async () => {
    const { html } = await pane();
    expect(carries(html, EDITION_ID), `the pane carries no ${EDITION_ID}`).toBe(true);
    expect(textOf(html, EDITION_ID), `${EDITION_ID} does not read ${EDITION_KEY}`).toBe(EDITION_KEY);
  });

  it('shows the project edition’s full digest, untruncated', async () => {
    const { html, pinned } = await pane();
    expect(carries(html, DIGEST_ID), `the pane carries no ${DIGEST_ID}`).toBe(true);
    expect(
      textOf(html, DIGEST_ID),
      'the digest on the pane is not the digest the project pinned',
    ).toBe(pinned.digest);
  });

  it('L-REG-07: the lineage is platform, tenant, project — in that DOM order', async () => {
    const { html, pinned } = await pane();
    expect(carries(html, LINEAGE_ID), `the pane carries no ${LINEAGE_ID}`).toBe(true);

    const lineage = elementAt(html, LINEAGE_ID);
    const positions = LINEAGE_ROWS.map((id) => lineage.indexOf(`data-testid="${id}"`));
    for (const [index, id] of LINEAGE_ROWS.entries()) {
      expect(positions[index], `${id} is not inside ${LINEAGE_ID}`).toBeGreaterThan(-1);
    }
    expect(
      [...positions].sort((a, b) => a - b),
      `the lineage rows are not in platform → tenant → project order: ${LINEAGE_ROWS.join(', ')}`,
    ).toEqual(positions);

    // A verbatim fork shares its parent's digest, and the pane shows all three in full so that
    // the equality is readable rather than claimed (design Interpretation 8).
    for (const id of LINEAGE_ROWS) {
      expect(
        textOf(html, id),
        `${id} does not carry the full digest of its edition`,
      ).toContain(pinned.digest);
    }
  });

  it('L-MEA-01: all seventeen parameters are there, with their ids, values and units', async () => {
    const { html } = await pane();
    expect(carries(html, PARAMS_ID), `the pane carries no ${PARAMS_ID}`).toBe(true);

    const params = elementAt(html, PARAMS_ID);
    const rendered = [...params.matchAll(/data-testid="ruleset-param-([A-Za-z0-9]+)"/g)].map(
      (match) => match[1] ?? '',
    );
    expect(
      [...rendered].sort(),
      'the parameter table does not render exactly L-MEA-01’s seventeen parameters',
    ).toEqual([...PARAMETER_IDS].sort());
    expect(
      rendered.length,
      `${PARAMS_ID} carries ${String(rendered.length)} rows — no parameter may be silently omitted`,
    ).toBe(PARAMETER_IDS.length);

    for (const [id, canonicalValue] of SEED_PARAMETERS) {
      const row = decodeEntities(elementAt(params, paramId(id)).replace(/<[^>]*>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
      const decidedRow = decided(id);
      expect(row, `the ${id} row does not name the parameter by its id`).toContain(id);
      expect(
        row,
        `the ${id} row shows neither ${decidedRow.display} nor ${canonicalValue}`,
      ).toContain(decidedRow.display);
      expect(row, `the ${id} row shows no unit — an empty cell is silence`).toContain(
        decidedRow.unit,
      );
    }
  });

  it('B-07 / L-FMT-01: the 20,000 sft outline maximum is grouped the Indian way', async () => {
    const { html } = await pane();
    const params = elementAt(html, PARAMS_ID);
    const row = decodeEntities(elementAt(params, paramId(GROUPED_ID)).replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    expect(row, `the ${GROUPED_ID} row does not show ${GROUPED_DISPLAY}`).toContain(GROUPED_DISPLAY);
    expect(row, `the ${GROUPED_ID} row does not carry L-MEA-01’s own spelling, ${GROUPED_UNIT}`)
      .toContain(GROUPED_UNIT);
    expect(
      decided(GROUPED_ID).display,
      'docs/design/s-project-settings.md §5 no longer decides the grouped value',
    ).toBe(GROUPED_DISPLAY);
  });

  it('R-SPINE-012: the pane performs no act — nothing on it writes', async () => {
    const { html } = await pane();
    const pinnedPane = elementAt(html, PARAMS_ID);
    expect(pinnedPane, `${PARAMS_ID} rendered empty`).not.toBe('');
    // Authoring a new edition is M3 and its own permission (L-MEA-01); the read-only pane
    // carries no form and no submit of its own.
    const forms = [...elementAt(html, 'project-ruleset').matchAll(/<form\b/g)].length;
    expect(forms, 'the ruleset pane carries a form — authoring is M3, not this increment').toBe(0);
  });
});

/* ─────────────── the tenant guard, on the same served build (AC-3, Q-12) ─────────────── */

describe('AC-3 / Q-12 — the pane is reachable only through a membership', () => {
  it('the same URL that serves the pin to its member serves nothing to a stranger', async () => {
    const { html } = await pane();
    // The control first: the pane is genuinely on this URL for the member who holds it.
    expect(
      carries(html, PARAMS_ID),
      'the member’s own GET carries no parameter table, so the refusal below would prove nothing',
    ).toBe(true);

    const { slug, port, pinned } = await reader();
    const path = rulesetPath(slug, pinned.projectId);
    const answered = await ask(`http://127.0.0.1:${String(port)}${path}`, new Map());
    expect(
      carries(answered.body, PARAMS_ID),
      'the parameter table was served to a reader with no session',
    ).toBe(false);
    expect(
      answered.url.includes('/sign-in') || answered.status >= 400,
      `a signed-out GET of ${path} answered ${String(answered.status)} at ${answered.url}`,
    ).toBe(true);
  });
});
