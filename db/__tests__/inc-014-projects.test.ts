/**
 * inc-014 — projects made real: the module, its fields, and the transactional founding
 * (AC-1; R-SPINE-010, R-SPINE-011, L-ACT-03, L-REG-07, V-DB).
 *
 * AC-1 is a claim about a *transaction*, so it is only provable against a real database:
 * "in ONE transaction it creates the pinned project … and inserts its creator as PRINCIPAL
 * through the act seam … When the founding grant is forced to fail, NO project row exists."
 * The honest proof of "or neither" is a failure the composing code cannot see coming, so a
 * trigger is installed on `participant_roles` as the owner and made to raise for one
 * nominated creator — inc-013's AC-3 idiom, pointed at the composition this increment adds
 * rather than at the seam it is composed from.
 *
 * The suite runs as `pnpm test:db db/__tests__/inc-014-projects.test.ts`: the root vitest
 * config excludes db/, because `pnpm verify` runs without a provisioned database.
 *
 * Three conventions this file follows deliberately:
 *
 *   - every product module is loaded by an absolute path assembled at run time. A literal
 *     `import '../../src/modules/spine/projects'` is resolved while the file is transformed,
 *     so on the day the module does not exist vite fails the whole file and vitest reports
 *     "0 test" — no failing assertion at all, which is the opposite of acceptance;
 *   - the R-SPINE-010 fields are read back by *searching the project's row for the value*
 *     rather than by naming a column. The Increment Spec fixes the module's exports, the
 *     form's test ids and the closed building-type enum; it does not fix the migration's
 *     column names, and a test that invented them would grade the Builder against this
 *     file's guesses instead of against the clause. `rule_set_edition_id` is named, because
 *     that column is existing law (L-REG-07, inc-012) and this increment must leave it
 *     standing;
 *   - fixtures are memoised into a promise each test awaits, never built in `beforeAll`: a
 *     throwing `beforeAll` reports its tests as skipped, and a skipped acceptance claim
 *     says nothing.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO } from './support/lanes';
import { APP_ROLE, MIGRATE_ROLE, connectAs, endAll, query } from './support/live';
import type { Client } from 'pg';

/* ─────────────────────────────── what the spec names ────────────────────────────────── */

/** The Increment Spec's `procedures`: "src/modules/spine/projects (barrel) exports …". */
const PROJECTS_MODULE = 'src/modules/spine/projects';
const DB_SEAM = 'src/core/db';

/** The six exports, verbatim from the contract. */
const EXPORTS = [
  'createProject',
  'updateProject',
  'archiveProject',
  'listProjects',
  'participantRoster',
  'roleHistory',
] as const;

/** The closed enum, verbatim from the contract. */
const BUILDING_TYPES = [
  'residential',
  'commercial',
  'mixed',
  'industrial',
  'infrastructure',
] as const;

const PRINCIPAL = 'PRINCIPAL';
const ASSIGN_PARTICIPANT_ROLE = 'ASSIGN_PARTICIPANT_ROLE';

/** L-ACT-03's three tables, as AC-1 lists the rows it wants to find. */
const PARTICIPANTS = 'participants';
const PARTICIPANT_ROLES = 'participant_roles';
const ACTS = 'acts';

const RUN = randomUUID().slice(0, 8);

/* ────────────────────────────────── loading the product ─────────────────────────────── */

const at = (relative: string): string => join(REPO, ...relative.split('/'));

async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const base = at(relative);
  const found = [base, `${base}.ts`, join(base, 'index.ts')].find((path) => existsSync(path));
  if (found === undefined) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(found).href)) as Record<string, unknown>;
}

function fn(module: Record<string, unknown>, name: string, where: string): CallableFunction {
  const value = module[name];
  expect(typeof value, `${where} exports no ${name} function`).toBe('function');
  return value as CallableFunction;
}

/* ─────────────────────────────── the seam, and a way past it ────────────────────────── */

interface ScopedHandle {
  execute: (statement: unknown) => Promise<unknown>;
}

interface DbSeam {
  readonly forTenant: (ctx: { tenantId: string }) => ScopedHandle;
  readonly closeDb?: () => Promise<void>;
}

/** The ctx shape every module function takes first (`ActCtx`, src/core/acts). */
interface Ctx {
  readonly db: unknown;
  readonly tenantId: string;
  readonly actorId: string;
}

const openClients: Client[] = [];
let closeSeam: (() => Promise<void>) | undefined;
let dropTrigger: (() => Promise<void>) | undefined;

afterAll(async () => {
  if (dropTrigger !== undefined) await dropTrigger().catch(() => undefined);
  await endAll(openClients);
  openClients.length = 0;
  if (closeSeam !== undefined) await closeSeam().catch(() => undefined);
});

let dbSeamOnce: Promise<DbSeam> | undefined;

function dbSeam(): Promise<DbSeam> {
  dbSeamOnce ??= (async () => {
    const module = await importProduct(DB_SEAM);
    if (typeof module['closeDb'] === 'function') {
      closeSeam = module['closeDb'] as () => Promise<void>;
    }
    return module as unknown as DbSeam;
  })();
  return dbSeamOnce;
}

/**
 * A connection that sees every tenant's rows. FORCEd row-level security binds the owner too,
 * so a raw connection with no `cubit.scope` sees nothing whichever role it is. This is how a
 * claim reads what the module wrote — and what it did not write — without going back through
 * it.
 */
let systemOnce: Promise<Client> | undefined;

function systemClient(): Promise<Client> {
  systemOnce ??= (async () => {
    const client = await connectAs(APP_ROLE);
    openClients.push(client);
    await client.query("select set_config('cubit.scope', 'system', false)");
    return client;
  })();
  return systemOnce;
}

/** The owner, for the induced failure and for the catalogue read. */
let ownerOnce: Promise<Client> | undefined;

function ownerClient(): Promise<Client> {
  ownerOnce ??= (async () => {
    const client = await connectAs(MIGRATE_ROLE);
    openClients.push(client);
    return client;
  })();
  return ownerOnce;
}

let projectsModuleOnce: Promise<Record<string, unknown>> | undefined;

function projectsModule(): Promise<Record<string, unknown>> {
  projectsModuleOnce ??= importProduct(PROJECTS_MODULE);
  return projectsModuleOnce;
}

async function projectsFn(name: string): Promise<CallableFunction> {
  return fn(await projectsModule(), name, PROJECTS_MODULE);
}

/* ──────────────────────────── reading rows without naming columns ───────────────────── */

type Row = Record<string, unknown>;

async function projectRow(projectId: string): Promise<Row | undefined> {
  const client = await systemClient();
  const rows = await query(client, 'select * from public.projects where id = $1', [projectId]);
  return rows[0];
}

async function projectRowsByCode(code: string): Promise<Row[]> {
  const client = await systemClient();
  return query(client, 'select * from public.projects where code = $1', [code]);
}

async function rowsFor(table: string, projectId: string): Promise<Row[]> {
  const client = await systemClient();
  return query(client, `select * from public."${table}" where project_id = $1`, [projectId]);
}

/**
 * Whether a row carries a value anywhere in it, compared the way a database hands values
 * back: `1000` and `'1000.00'` are the same target GFA, `3` and `'3'` the same storey count.
 *
 * This is what lets AC-1's "accepts … client, siteAddress, district, buildingType, storeys,
 * targetGfaM2, notes" be graded on the clause rather than on a column name this file made up.
 */
function carries(row: Row, value: string): boolean {
  const wanted = value.trim();
  const asNumber = Number(wanted);
  for (const held of Object.values(row)) {
    if (held === null || held === undefined) continue;
    const text = String(held).trim();
    if (text === wanted) return true;
    if (wanted !== '' && Number.isFinite(asNumber) && text !== '' && Number(text) === asNumber) {
      return true;
    }
  }
  return false;
}

/** Every value in a row, as text — what a failure message has to show to be actionable. */
const showRow = (row: Row | undefined): string =>
  row === undefined ? '(no row)' : JSON.stringify(row, (_key, held: unknown) => held ?? null);

/** Whether an arbitrary answer carries a value somewhere in it (shape-agnostic). */
function mentions(answer: unknown, value: string): boolean {
  return JSON.stringify(answer ?? null).includes(JSON.stringify(value).slice(1, -1));
}

type Went =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: unknown };

async function went(action: () => Promise<unknown>): Promise<Went> {
  try {
    return { ok: true, value: await action() };
  } catch (error: unknown) {
    return { ok: false, error };
  }
}

function saidWhat(outcome: Went): string {
  if (outcome.ok) return `it succeeded and returned ${JSON.stringify(outcome.value ?? null)}`;
  const error = outcome.error as { code?: unknown; message?: unknown };
  return `[${String(error.code ?? '?')}] ${String(error.message ?? String(outcome.error))}`;
}

/** The project id a creator answered with, however it is wrapped. */
function projectIdOf(answer: unknown): string {
  if (typeof answer === 'string') return answer;
  const named = (answer ?? {}) as Record<string, unknown>;
  for (const key of ['projectId', 'id']) {
    const held = named[key];
    if (typeof held === 'string') return held;
  }
  const project = named['project'];
  if (typeof project === 'object' && project !== null) {
    const inner = (project as Record<string, unknown>)['id'];
    if (typeof inner === 'string') return inner;
  }
  return '';
}

/* ────────────────────────────────────── the fixture ─────────────────────────────────── */

interface Person {
  readonly userId: string;
  readonly email: string;
}

interface Fixture {
  readonly tenantId: string;
  readonly founder: Person;
  /** The creator whose founding grant the trigger of AC-1's rollback claim refuses. */
  readonly cursed: Person;
}

let fixtureOnce: Promise<Fixture> | undefined;

function fixture(): Promise<Fixture> {
  fixtureOnce ??= (async () => {
    const system = await systemClient();
    const tenantRows = await query(
      system,
      'insert into public.tenants (slug, name) values ($1, $2) returning id',
      [`inc014-${RUN}`, `inc014 ${RUN}`],
    );
    const tenantId = String(tenantRows[0]?.['id'] ?? '');
    expect(tenantId, 'no tenant row').not.toBe('');

    const mint = async (label: string): Promise<Person> => {
      const email = `inc014-${RUN}-${label}@example.test`;
      const rows = await query(
        system,
        'insert into public.users (email, name, email_verified) values ($1, $2, true) returning id',
        [email, label],
      );
      const userId = String(rows[0]?.['id'] ?? '');
      expect(userId, `no user row for ${label}`).not.toBe('');
      await query(
        system,
        'insert into public.tenant_memberships (tenant_id, user_id, role) values ($1, $2, $3)',
        [tenantId, userId, 'member'],
      );
      return { userId, email };
    };

    return { tenantId, founder: await mint('founder'), cursed: await mint('cursed') };
  })();
  return fixtureOnce;
}

async function ctxFor(person: Person): Promise<Ctx> {
  const { forTenant } = await dbSeam();
  const { tenantId } = await fixture();
  return { db: forTenant({ tenantId }), tenantId, actorId: person.userId };
}

/** Every R-SPINE-010 field, each carrying a value nothing else in this run holds. */
function newProject(label: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: `inc014 ${label} ${RUN}`,
    code: `INC014-${label.toUpperCase()}-${RUN}`,
    client: `Client ${label} ${RUN}`,
    siteAddress: `${RUN} Site Road, plot ${label}`,
    district: `District-${label}-${RUN}`,
    buildingType: 'residential',
    storeys: 7,
    targetGfaM2: '1000',
    notes: `Notes for ${label} ${RUN}`,
    ...overrides,
  };
}

/** Create a project through the module, and say plainly when the module refused. */
async function create(person: Person, input: Record<string, unknown>): Promise<string> {
  const createProject = await projectsFn('createProject');
  const outcome = await went(
    async () => createProject(await ctxFor(person), input) as Promise<unknown>,
  );
  expect(
    outcome.ok,
    `createProject(${String(input['code'])}) did not create the project — ${saidWhat(outcome)}`,
  ).toBe(true);
  const projectId = projectIdOf(outcome.ok ? outcome.value : undefined);
  expect(
    projectId,
    `createProject answered with no project id — ${saidWhat(outcome)}`,
  ).toMatch(/^[0-9a-f-]{36}$/i);
  return projectId;
}

/* ──────────────────────────── AC-1: the module's own surface ────────────────────────── */

describe('AC-1 — the projects module (R-SPINE-010, the Increment Spec’s procedures)', () => {
  for (const name of EXPORTS) {
    it(`AC-1: ${PROJECTS_MODULE} exports ${name}`, async () => {
      await projectsFn(name);
    });
  }
});

/* ──────────────────── AC-1: the founding, and everything it must leave ──────────────── */

describe('AC-1 — createProject founds the project and its PRINCIPAL together (L-ACT-03)', () => {
  it('AC-1: the pinned project, a participants row, a PRINCIPAL grant and an ASSIGN_PARTICIPANT_ROLE act all exist for (project, creator)', async () => {
    const { founder } = await fixture();
    const projectId = await create(founder, newProject('founding'));

    // L-REG-07 unbroken: the pin is still on the row this increment's migration extended.
    const row = await projectRow(projectId);
    expect(row, `no projects row for ${projectId}`).toBeDefined();
    expect(
      row?.['rule_set_edition_id'] ?? null,
      `the created project is unpinned — ${showRow(row)}`,
    ).not.toBeNull();

    // L-ACT-03: "project creation inserts its creator as PRINCIPAL in the same transaction",
    // and "assignment is itself an act" — so all three rows, for this creator, on this project.
    const participants = await rowsFor(PARTICIPANTS, projectId);
    expect(
      participants.filter((held) => String(held['user_id']) === founder.userId).length,
      `no ${PARTICIPANTS} row for the creator — ${JSON.stringify(participants)}`,
    ).toBe(1);

    const grants = await rowsFor(PARTICIPANT_ROLES, projectId);
    const founding = grants.filter((held) => String(held['user_id']) === founder.userId);
    expect(
      founding.length,
      `no ${PARTICIPANT_ROLES} row for the creator — ${JSON.stringify(grants)}`,
    ).toBe(1);
    expect(
      String(founding[0]?.['role'] ?? ''),
      `the creator was not founded ${PRINCIPAL} — ${JSON.stringify(founding)}`,
    ).toBe(PRINCIPAL);

    const acts = await rowsFor(ACTS, projectId);
    const assignments = acts.filter(
      (held) => String(held['type'] ?? held['act_type'] ?? '') === ASSIGN_PARTICIPANT_ROLE,
    );
    expect(
      assignments.length,
      `the founding grant left no ${ASSIGN_PARTICIPANT_ROLE} act row — ${JSON.stringify(acts)}`,
    ).toBe(1);
  });

  it('AC-1: every R-SPINE-010 field the creator was given is on the project row', async () => {
    const { founder } = await fixture();
    const input = newProject('fields');
    const projectId = await create(founder, input);
    const row = await projectRow(projectId);
    expect(row, `no projects row for ${projectId}`).toBeDefined();

    // R-SPINE-010, verbatim: "name, code, client, site address + district …, building type …,
    // storeys, target GFA …, notes". Read by value, never by a column name this file invented.
    for (const field of [
      'name',
      'code',
      'client',
      'siteAddress',
      'district',
      'buildingType',
      'storeys',
      'targetGfaM2',
      'notes',
    ]) {
      const given = String(input[field]);
      expect(
        carries(row as Row, given),
        `the project row carries no value equal to ${field}=${JSON.stringify(given)} — ${showRow(row)}`,
      ).toBe(true);
    }
  });

  for (const buildingType of BUILDING_TYPES) {
    it(`AC-1: buildingType ${buildingType} is accepted and stored verbatim`, async () => {
      const { founder } = await fixture();
      const input = newProject(`bt-${buildingType}`, { buildingType });
      const projectId = await create(founder, input);
      const row = await projectRow(projectId);
      expect(
        carries(row as Row, buildingType),
        `${buildingType} did not reach the row verbatim — ${showRow(row)}`,
      ).toBe(true);
    });
  }

  it('AC-1: a buildingType outside the closed enum is refused, and no project row is left', async () => {
    const { founder } = await fixture();
    const input = newProject('bt-outside', { buildingType: 'palatial' });
    const createProject = await projectsFn('createProject');
    const outcome = await went(
      async () => createProject(await ctxFor(founder), input) as Promise<unknown>,
    );
    expect(
      outcome.ok,
      `"palatial" is not one of ${BUILDING_TYPES.join(' | ')}, but createProject accepted it — ${saidWhat(outcome)}`,
    ).toBe(false);
    expect(
      await projectRowsByCode(String(input['code'])),
      'a refused creation still left a project row',
    ).toEqual([]);
  });
});

/* ─────────────────── AC-1: "when the founding grant is forced to fail" ──────────────── */

describe('AC-1 — the founding is one transaction, so a failed grant leaves no project', () => {
  /**
   * A failure the composing code cannot see coming: the state half of the founding is made to
   * raise underneath a commit `createProject` believes in. The trigger is installed as the
   * owner and cuts on the creator, because the project's id does not exist until the very
   * transaction being tested has already begun.
   *
   * A composition that opened its own connection per statement — or that created the project
   * first and founded the principal afterwards — keeps the project row. One transaction
   * keeps nothing, which is exactly the sentence AC-1 makes testable.
   */
  async function curseTheGrant(userId: string): Promise<void> {
    const owner = await ownerClient();
    const name = `inc014_curse_${RUN}`;
    await owner.query(`
      create or replace function public.${name}() returns trigger
      language plpgsql as $$
      begin
        if new.user_id = '${userId}'::uuid then
          raise exception 'inc-014: the founding grant is refused for this creator';
        end if;
        return new;
      end $$;
    `);
    await owner.query(
      `create trigger ${name} before insert on public.${PARTICIPANT_ROLES}
         for each row execute function public.${name}()`,
    );
    dropTrigger = async () => {
      await owner.query(`drop trigger if exists ${name} on public.${PARTICIPANT_ROLES}`);
      await owner.query(`drop function if exists public.${name}()`);
    };
  }

  it('AC-1: when the founding grant raises, NO project row exists', async () => {
    const { cursed, founder } = await fixture();
    await curseTheGrant(cursed.userId);

    // The control, taken with the trigger already installed: it fires on the cursed creator
    // and on nobody else, so a green rollback claim cannot be the trigger refusing everything.
    const control = newProject('control');
    const controlId = await create(founder, control);
    expect(
      (await rowsFor(PARTICIPANT_ROLES, controlId)).length,
      'the control creation founded no grant — the trigger is refusing more than it should',
    ).toBe(1);

    const doomed = newProject('doomed');
    const createProject = await projectsFn('createProject');
    const outcome = await went(
      async () => createProject(await ctxFor(cursed), doomed) as Promise<unknown>,
    );
    expect(
      outcome.ok,
      `the founding grant raised, but createProject reported success — ${saidWhat(outcome)}`,
    ).toBe(false);

    // L-ACT-03: "in the same transaction". Not "the act row was rolled back" — the *project*
    // must not exist, because a project with no principal is the state the clause forbids.
    expect(
      await projectRowsByCode(String(doomed['code'])),
      `the founding grant failed but the project row stands — ${JSON.stringify(await projectRowsByCode(String(doomed['code'])))}`,
    ).toEqual([]);
  });
});

/* ─────────────────────── AC-3: the round trip the module has to hold ─────────────────── */

describe('AC-3 — create / edit / archive round trip, at the module (R-SPINE-010)', () => {
  it('AC-3: updateProject persists a changed field', async () => {
    const { founder } = await fixture();
    const projectId = await create(founder, newProject('edit'));
    const updateProject = await projectsFn('updateProject');
    const renamed = `inc014 renamed ${RUN}`;
    const outcome = await went(
      async () =>
        updateProject(await ctxFor(founder), { projectId, id: projectId, name: renamed }) as Promise<unknown>,
    );
    expect(outcome.ok, `updateProject did not persist the edit — ${saidWhat(outcome)}`).toBe(true);
    const row = await projectRow(projectId);
    expect(
      carries(row as Row, renamed),
      `the edited name is not on the row — ${showRow(row)}`,
    ).toBe(true);
  });

  it('AC-3: archiveProject records the archive state, and the project leaves the default listProjects answer', async () => {
    const { founder } = await fixture();
    const kept = await create(founder, newProject('kept'));
    const shelved = await create(founder, newProject('shelved'));
    const before = await projectRow(shelved);

    const listProjects = await projectsFn('listProjects');
    const listedBefore = await listProjects(await ctxFor(founder));
    expect(
      mentions(listedBefore, shelved),
      `listProjects does not list an unarchived project — ${JSON.stringify(listedBefore ?? null)}`,
    ).toBe(true);

    const archiveProject = await projectsFn('archiveProject');
    const outcome = await went(
      async () =>
        archiveProject(await ctxFor(founder), { projectId: shelved, id: shelved }) as Promise<unknown>,
    );
    expect(outcome.ok, `archiveProject refused — ${saidWhat(outcome)}`).toBe(true);

    // The row is still there (Interpretation 10: archiving changes visibility, not existence)
    // and something on it now says so.
    const after = await projectRow(shelved);
    expect(after, 'archiveProject deleted the project row').toBeDefined();
    expect(
      JSON.stringify(after ?? null) !== JSON.stringify(before ?? null),
      `archiveProject changed nothing on the project row — ${showRow(after)}`,
    ).toBe(true);

    // AC-3: "it leaves the default S-Home grid" — the grid is one `listProjects` read.
    const listedAfter = await listProjects(await ctxFor(founder));
    expect(
      mentions(listedAfter, shelved),
      `an archived project is still in the default listProjects answer — ${JSON.stringify(listedAfter ?? null)}`,
    ).toBe(false);
    expect(
      mentions(listedAfter, kept),
      `archiving one project dropped another from listProjects — ${JSON.stringify(listedAfter ?? null)}`,
    ).toBe(true);
  });
});

/* ─────────────────── AC-4 / AC-8: the roster and the history the panes read ──────────── */

describe('AC-4 — the roster and the role history the participants pane reads (R-SPINE-011)', () => {
  it('AC-4: participantRoster answers with the founding PRINCIPAL', async () => {
    const { founder } = await fixture();
    const projectId = await create(founder, newProject('roster'));
    const participantRoster = await projectsFn('participantRoster');
    const roster = (await participantRoster(await ctxFor(founder), {
      projectId,
      id: projectId,
    })) as unknown;
    expect(
      mentions(roster, founder.userId) && mentions(roster, PRINCIPAL),
      `the roster does not carry the creator as ${PRINCIPAL} — ${JSON.stringify(roster ?? null)}`,
    ).toBe(true);
  });

  it('AC-4: roleHistory answers with the founding grant — it is a real, visible act', async () => {
    const { founder } = await fixture();
    const projectId = await create(founder, newProject('history'));
    const roleHistory = await projectsFn('roleHistory');
    const history = (await roleHistory(await ctxFor(founder), {
      projectId,
      id: projectId,
    })) as unknown;
    expect(
      Array.isArray(history),
      `roleHistory did not answer with a list — ${JSON.stringify(history ?? null)}`,
    ).toBe(true);
    expect(
      (history as unknown[]).length,
      'roleHistory is empty, but every project is founded by a grant (L-ACT-03)',
    ).toBeGreaterThanOrEqual(1);
    expect(
      mentions(history, founder.userId) && mentions(history, PRINCIPAL),
      `the founding grant is not in the history — ${JSON.stringify(history ?? null)}`,
    ).toBe(true);
  });
});

/* ─────────────────────── L-REG-07: the migration must not break the pin ─────────────── */

describe('L-REG-07 — the new migration leaves the pin NOT NULL', () => {
  /**
   * The guard is written through `createProject` on purpose. A bare catalogue read would be
   * green today, before the migration this increment adds even exists — it would pass by
   * describing the tree as it already is, and say nothing about the change being graded. Bound
   * to a project the new module actually created, it is red until the migration lands and a
   * real guard against the migration that relaxes the pin thereafter.
   */
  it('L-REG-07: a project created through the new module is pinned, and the column is still NOT NULL', async () => {
    const { founder } = await fixture();
    const projectId = await create(founder, newProject('pin'));
    const row = await projectRow(projectId);
    expect(
      row?.['rule_set_edition_id'] ?? null,
      `the created project is unpinned — ${showRow(row)}`,
    ).not.toBeNull();

    const owner = await ownerClient();
    const rows = await query(
      owner,
      `select is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'projects'
          and column_name = 'rule_set_edition_id'`,
      [],
    );
    expect(rows.length, 'projects.rule_set_edition_id is gone from the schema').toBe(1);
    expect(
      String(rows[0]?.['is_nullable'] ?? ''),
      'an unpinned project has become representable (L-REG-07)',
    ).toBe('NO');
  });
});
