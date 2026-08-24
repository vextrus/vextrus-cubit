/**
 * inc-015 — the act log explorer's read model: `actLog` (AC-2, AC-3; R-SPINE-081, L-ACT-01,
 * S-Audit).
 *
 * The Increment Spec puts the contract claims on `actLog` here: "Contract claims on actLog live
 * in db/__tests__/inc-015-audit.test.ts … importing the barrel src/modules/spine/audit by a
 * runtime-assembled absolute specifier". They live in the db lane and not beside the module
 * because every one of them is a claim about rows — a derived consequence, an ordering, a
 * filter — and rows need a live cluster. Run it with `pnpm test:db inc-015`; the root vitest
 * config excludes `db/`, so `pnpm vitest run` finds nothing here.
 *
 * Four conventions this file follows deliberately, three of them inc-014's:
 *
 *   - the module is loaded by an absolute path assembled at run time. A literal
 *     `import '../../src/modules/spine/audit'` is resolved while the file is transformed, so on
 *     the day the module does not exist vite fails the whole file and vitest reports "0 test" —
 *     no failing assertion at all, which is the opposite of acceptance;
 *   - fixtures are memoised into a promise each test awaits, never built in `beforeAll`: a
 *     throwing `beforeAll` reports its tests as skipped, and a skipped acceptance claim says
 *     nothing;
 *   - what the module answers is compared against the *rows*, read back through a system-scoped
 *     connection — the consequence pair is a join this file performs for itself rather than a
 *     shape it trusts the module to have got right;
 *   - the acts are made through the seam (`previewAct` / `commitAct`, `createProject`), never by
 *     insert. L-ACT-01 makes the seam the sole writer of the log, so a fixture that wrote act
 *     rows by hand would be proving the reader against a log the product could not produce.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO } from './support/lanes';
import { APP_ROLE, connectAs, endAll, query } from './support/live';
import type { Client } from 'pg';

/* ─────────────────────────────── what the spec names ────────────────────────────────── */

/** The Increment Spec's `interfaces`: "src/modules/spine/audit/index.ts (barrel) exports …". */
const AUDIT_MODULE = 'src/modules/spine/audit';
const PROJECTS_MODULE = 'src/modules/spine/projects';
const ACT_SEAM = 'src/core/acts';
const DB_SEAM = 'src/core/db';

/** The vocabulary literals the test contract lets this suite quote (L-ACT-03's closed words). */
const ASSIGN_PARTICIPANT_ROLE = 'ASSIGN_PARTICIPANT_ROLE';
const PRINCIPAL = 'PRINCIPAL';
const REVIEWER = 'REVIEWER';
const MEASURER = 'MEASURER';

const RUN = randomUUID().slice(0, 8);

/* ────────────────────────────────── loading the product ─────────────────────────────── */

const at = (relative: string): string => join(REPO, ...relative.split('/'));

async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const base = at(relative);
  const found = [base, `${base}.ts`, join(base, 'index.ts')].find((path) => existsSync(path));
  expect(found, `${relative} is not in the tree`).toBeDefined();
  return (await import(pathToFileURL(String(found)).href)) as Record<string, unknown>;
}

function fn(module: Record<string, unknown>, name: string, where: string): CallableFunction {
  const value = module[name];
  expect(typeof value, `${where} exports no ${name} function`).toBe('function');
  return value as CallableFunction;
}

const modules = new Map<string, Promise<Record<string, unknown>>>();

function product(relative: string): Promise<Record<string, unknown>> {
  const held = modules.get(relative);
  if (held !== undefined) return held;
  const loading = importProduct(relative);
  modules.set(relative, loading);
  return loading;
}

/* ───────────────────────────────── the live cluster ─────────────────────────────────── */

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

afterAll(async () => {
  await endAll(openClients);
  openClients.length = 0;
  if (closeSeam !== undefined) await closeSeam().catch(() => undefined);
});

let dbSeamOnce: Promise<DbSeam> | undefined;

function dbSeam(): Promise<DbSeam> {
  dbSeamOnce ??= (async () => {
    const module = await product(DB_SEAM);
    if (typeof module['closeDb'] === 'function') {
      closeSeam = module['closeDb'] as () => Promise<void>;
    }
    return module as unknown as DbSeam;
  })();
  return dbSeamOnce;
}

/**
 * A connection that sees every tenant's rows. FORCEd row-level security binds the owner too, so
 * a raw connection with no `cubit.scope` sees nothing whichever role it is. This is how the
 * claims read the log back without going through the reader they are grading.
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

type Row = Record<string, unknown>;

async function rowsFor(table: string, projectId: string): Promise<Row[]> {
  const client = await systemClient();
  return query(client, `select * from public."${table}" where project_id = $1`, [projectId]);
}

/* ────────────────────────────────────── the fixture ─────────────────────────────────── */

interface Person {
  readonly userId: string;
  readonly email: string;
}

interface Fixture {
  readonly tenantId: string;
  /** A second workspace, whose ctx must not be able to read the first one's log. */
  readonly otherTenantId: string;
  readonly founder: Person;
  readonly bee: Person;
  readonly cee: Person;
  readonly outsider: Person;
  readonly projectId: string;
  /** A second project of the same tenant — the explorer is per project (R-SPINE-081). */
  readonly otherProjectId: string;
}

let fixtureOnce: Promise<Fixture> | undefined;

/**
 * One project, four acts, in a known order:
 *
 *   1. the founding PRINCIPAL grant  — founder acts, founder is the subject;
 *   2. REVIEWER to B                 — founder acts, B is the subject;
 *   3. PRINCIPAL to B                — founder acts, B is the subject;
 *   4. MEASURER to C                 — **B** acts, C is the subject.
 *
 * The fourth is what makes actor and subject two different questions: every filter claim below
 * would pass on an implementation that confused them if the reader were the only actor.
 */
function fixture(): Promise<Fixture> {
  fixtureOnce ??= (async () => {
    const system = await systemClient();

    const tenant = async (label: string): Promise<string> => {
      const rows = await query(
        system,
        'insert into public.tenants (slug, name) values ($1, $2) returning id',
        [`inc015-${label}-${RUN}`, `inc015 ${label} ${RUN}`],
      );
      const id = String(rows[0]?.['id'] ?? '');
      expect(id, `no tenant row for ${label}`).not.toBe('');
      return id;
    };

    const tenantId = await tenant('home');
    const otherTenantId = await tenant('other');

    const mint = async (label: string, workspace: string): Promise<Person> => {
      const email = `inc015-${RUN}-${label}@example.test`;
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
        [workspace, userId, 'member'],
      );
      return { userId, email };
    };

    const founder = await mint('founder', tenantId);
    const bee = await mint('bee', tenantId);
    const cee = await mint('cee', tenantId);
    const outsider = await mint('outsider', otherTenantId);

    const projectId = await createProject(tenantId, founder, 'audit');
    const otherProjectId = await createProject(tenantId, founder, 'sibling');

    await grant(tenantId, founder, projectId, bee, REVIEWER);
    await grant(tenantId, founder, projectId, bee, PRINCIPAL);
    await grant(tenantId, bee, projectId, cee, MEASURER);

    return { tenantId, otherTenantId, founder, bee, cee, outsider, projectId, otherProjectId };
  })();
  return fixtureOnce;
}

async function ctxFor(tenantId: string, person: Person): Promise<Ctx> {
  const { forTenant } = await dbSeam();
  return { db: forTenant({ tenantId }), tenantId, actorId: person.userId };
}

/** A project founded through the product, so its founding act is the product's own. */
async function createProject(
  tenantId: string,
  founder: Person,
  label: string,
): Promise<string> {
  const create = fn(await product(PROJECTS_MODULE), 'createProject', PROJECTS_MODULE);
  const answer = (await create(await ctxFor(tenantId, founder), {
    name: `inc015 ${label} ${RUN}`,
    code: `INC015-${label.toUpperCase()}-${RUN}`,
  })) as { projectId?: string; id?: string } | string;
  const projectId = typeof answer === 'string' ? answer : (answer.projectId ?? answer.id ?? '');
  expect(projectId, `createProject(${label}) answered with no project id`).toMatch(
    /^[0-9a-f-]{36}$/i,
  );
  return projectId;
}

/** A role grant, made the only way L-ACT-01 allows one to be made: through the seam. */
async function grant(
  tenantId: string,
  actor: Person,
  projectId: string,
  subject: Person,
  role: string,
): Promise<void> {
  const seam = await product(ACT_SEAM);
  const preview = fn(seam, 'previewAct', ACT_SEAM);
  const commit = fn(seam, 'commitAct', ACT_SEAM);
  const ctx = await ctxFor(tenantId, actor);
  const input = { projectId, userId: subject.userId, role };
  const previewed = (await preview(ctx, ASSIGN_PARTICIPANT_ROLE, input)) as { digest: string };
  await commit(ctx, ASSIGN_PARTICIPANT_ROLE, input, previewed.digest);
}

/* ─────────────────────────────── calling the thing itself ───────────────────────────── */

/** The entry shape the Increment Spec's `interfaces` fixes, as a claim reads one. */
interface Entry {
  readonly actId: string;
  readonly actType: string;
  readonly actorId: string;
  readonly actorEmail: string;
  readonly subjectId: string;
  readonly subjectEmail: string;
  readonly role: string;
  readonly at: string;
  readonly evidence: readonly unknown[];
}

async function actLog(
  ctx: Ctx,
  input: Record<string, unknown>,
): Promise<readonly Entry[]> {
  const read = fn(await product(AUDIT_MODULE), 'actLog', AUDIT_MODULE);
  const answer = (await read(ctx, input)) as readonly Entry[];
  expect(Array.isArray(answer), `actLog answered ${JSON.stringify(answer ?? null)}, not a list`).toBe(
    true,
  );
  return answer;
}

/** The whole log of the fixture's project, as the founder reads it. */
async function wholeLog(): Promise<readonly Entry[]> {
  const { tenantId, founder, projectId } = await fixture();
  return actLog(await ctxFor(tenantId, founder), { projectId });
}

const said = (entries: readonly Entry[]): string =>
  JSON.stringify(entries.map((entry) => [entry.actType, entry.actorEmail, entry.subjectEmail, entry.role]));

/** The act ids of a list, as a set — how one read is compared against another. */
const idsOf = (entries: readonly Entry[]): Set<string> =>
  new Set(entries.map((entry) => entry.actId));

/**
 * What a filter must answer, derived from the unfiltered log rather than from a number typed
 * into this file: "filtering by actor shows only that actor's acts" is a rule about the whole
 * log, and a count copied out of today's fixture would freeze it (and would say nothing about
 * whether the right rows were kept).
 */
async function expectFilterKeeps(
  input: Record<string, unknown>,
  keep: (entry: Entry) => boolean,
  why: string,
): Promise<readonly Entry[]> {
  const { tenantId, founder, projectId } = await fixture();
  const ctx = await ctxFor(tenantId, founder);
  const whole = await actLog(ctx, { projectId });
  const wanted = whole.filter(keep);
  const answered = await actLog(ctx, { projectId, ...input });
  expect(
    [...idsOf(answered)].sort(),
    `${why} — ${JSON.stringify(input)} answered ${said(answered)}, and the log holds ${said(whole)}`,
  ).toEqual([...idsOf(wanted)].sort());
  // Order survives filtering: a filtered read is the same log with rows removed.
  expect(
    answered.map((entry) => entry.actId),
    `${why} — the filtered read is not still newest-first`,
  ).toEqual(wanted.map((entry) => entry.actId));
  return answered;
}

/* ───────────────────────────── AC-2 — the module's surface ──────────────────────────── */

describe('AC-2 — the audit module reads the act log (the Increment Spec’s interfaces)', () => {
  it('AC-2: src/modules/spine/audit exports actLog', async () => {
    fn(await product(AUDIT_MODULE), 'actLog', AUDIT_MODULE);
  });

  it('AC-2: every entry carries the members the contract fixes, and evidence is an empty array', async () => {
    const { founder, bee, cee, projectId } = await fixture();
    const entries = await wholeLog();
    // "one entry per act", read as the rule it is: the log's length is the project's act rows,
    // whatever a later increment adds to them — never a number copied out of this fixture.
    const acts = await rowsFor('acts', projectId);
    expect(
      entries.length,
      `the project holds ${acts.length} act rows and the log lists ${entries.length} — ${said(entries)}`,
    ).toBe(acts.length);
    expect(acts.length, 'the fixture performed four acts on this project').toBeGreaterThanOrEqual(4);

    const emails = new Set([founder.email, bee.email, cee.email]);
    for (const entry of entries) {
      expect(entry.actId, `an entry carries no act id — ${said(entries)}`).toMatch(
        /^[0-9a-f-]{36}$/i,
      );
      expect(entry.actType, `an entry carries the wrong act type — ${said(entries)}`).toBe(
        ASSIGN_PARTICIPANT_ROLE,
      );
      expect(entry.actorId, 'an entry carries no actor id').toMatch(/^[0-9a-f-]{36}$/i);
      expect(entry.subjectId, 'an entry carries no subject id').toMatch(/^[0-9a-f-]{36}$/i);
      expect(emails.has(entry.actorEmail), `actorEmail “${entry.actorEmail}” is nobody`).toBe(true);
      expect(emails.has(entry.subjectEmail), `subjectEmail “${entry.subjectEmail}” is nobody`).toBe(
        true,
      );
      expect([PRINCIPAL, REVIEWER, MEASURER]).toContain(entry.role);
      expect(
        Number.isFinite(Date.parse(entry.at)),
        `an entry's time “${entry.at}” is not an instant`,
      ).toBe(true);
      // M0 acts cite nothing, and the contract says so as a type: `evidence: readonly []`.
      expect(Array.isArray(entry.evidence), 'evidence is not a list').toBe(true);
      expect(entry.evidence, 'evidence is not empty in M0').toHaveLength(0);
    }
  });

  it('AC-2: entries are newest-first', async () => {
    const entries = await wholeLog();
    const times = entries.map((entry) => Date.parse(entry.at));
    expect(
      times.slice(),
      `the log is not ordered newest-first — ${said(entries)}`,
    ).toEqual(times.slice().sort((left, right) => right - left));

    // The four acts were performed in a known order, so their entries appear in the opposite
    // one — an ordering that ties on the timestamp is still wrong if it puts them out of order.
    // Read by position, so acts a later increment lawfully adds cannot redden the claim.
    const { founder, bee, cee } = await fixture();
    const pairs = entries.map((entry) => `${entry.subjectEmail}:${entry.role}`);
    const positionOf = (pair: string): number => {
      const found = pairs.indexOf(pair);
      expect(found, `the log names no act “${pair}” — ${said(entries)}`).toBeGreaterThanOrEqual(0);
      return found;
    };
    const performed = [
      `${founder.email}:${PRINCIPAL}`,
      `${bee.email}:${REVIEWER}`,
      `${bee.email}:${PRINCIPAL}`,
      `${cee.email}:${MEASURER}`,
    ].map(positionOf);
    expect(
      performed,
      `the acts are not in reverse order of performance — ${said(entries)}`,
    ).toEqual(performed.slice().sort((left, right) => right - left));
  });

  it('AC-2: the consequence is the derived pair — the participant_roles row joined on act_id', async () => {
    const { projectId } = await fixture();
    const entries = await wholeLog();
    const grants = await rowsFor('participant_roles', projectId);
    const acts = await rowsFor('acts', projectId);

    for (const entry of entries) {
      const row = grants.find((held) => String(held['act_id']) === entry.actId);
      expect(row, `no participant_roles row joins act ${entry.actId} — ${said(entries)}`).toBeDefined();
      expect(entry.role, `the entry's role is not the granted role`).toBe(String(row?.['role']));
      expect(
        entry.subjectId,
        'the entry names somebody other than the grantee as its subject',
      ).toBe(String(row?.['user_id']));

      const act = acts.find((held) => String(held['id']) === entry.actId);
      expect(act, `the entry names an act that is not on this project`).toBeDefined();
      expect(entry.actorId, 'the entry names somebody other than the act’s actor').toBe(
        String(act?.['actor_id']),
      );
    }
  });
});

/* ────────────────────────────── AC-3 — the filters compose ──────────────────────────── */

describe('AC-3 — type, actor and subject filter and compose (actor/subject are emails)', () => {
  it('AC-3: by type — the act type lists its own acts, an unknown type lists none', async () => {
    const assigned = await expectFilterKeeps(
      { type: ASSIGN_PARTICIPANT_ROLE },
      (entry) => entry.actType === ASSIGN_PARTICIPANT_ROLE,
      'filtering by an act type must keep exactly that type',
    );
    expect(assigned.length, 'the fixture performed four acts of this type').toBeGreaterThanOrEqual(4);

    const { tenantId, founder, projectId } = await fixture();
    const none = await actLog(await ctxFor(tenantId, founder), {
      projectId,
      type: 'NO_SUCH_ACT_TYPE',
    });
    expect(none, 'an act type nothing performed answered rows').toHaveLength(0);
  });

  it('AC-3: by actor — only that person’s acts, and an actor who acted nowhere lists none', async () => {
    const { tenantId, founder, bee, cee, projectId } = await fixture();

    await expectFilterKeeps(
      { actor: founder.email },
      (entry) => entry.actorEmail === founder.email,
      'filtering by actor must keep exactly that actor’s acts',
    );

    const byBee = await expectFilterKeeps(
      { actor: bee.email },
      (entry) => entry.actorEmail === bee.email,
      'filtering by actor must keep exactly that actor’s acts',
    );
    expect(byBee.length, `B performed one act — ${said(byBee)}`).toBe(1);
    expect(byBee[0]?.subjectEmail, 'B’s act was about C').toBe(cee.email);
    expect(byBee[0]?.role).toBe(MEASURER);

    // C acted never — an actor with no acts is an empty list, not every act they appear in.
    const ctx = await ctxFor(tenantId, founder);
    const byCee = await actLog(ctx, { projectId, actor: cee.email });
    expect(byCee, `C performed no act, but the log answered ${said(byCee)}`).toHaveLength(0);

    const byNobody = await actLog(ctx, { projectId, actor: 'nobody@example.invalid' });
    expect(byNobody, 'an address nobody holds answered rows').toHaveLength(0);
  });

  it('AC-3: by subject — only acts about that person', async () => {
    const { founder, bee, cee } = await fixture();

    const aboutBee = await expectFilterKeeps(
      { subject: bee.email },
      (entry) => entry.subjectEmail === bee.email,
      'filtering by subject must keep exactly the acts about that person',
    );
    expect(aboutBee.map((entry) => entry.role), `the two grants to B, newest first`).toEqual([
      PRINCIPAL,
      REVIEWER,
    ]);

    // The founding grant is about the founder, and B's own act is about C: a subject filter
    // that answered "every act this person touched" would list three here, not one.
    const aboutFounder = await expectFilterKeeps(
      { subject: founder.email },
      (entry) => entry.subjectEmail === founder.email,
      'a subject filter is not "every act this person appears in"',
    );
    expect(aboutFounder.length, `one act is about the founder — ${said(aboutFounder)}`).toBe(1);
    expect(aboutFounder[0]?.role).toBe(PRINCIPAL);

    const aboutCee = await expectFilterKeeps(
      { subject: cee.email },
      (entry) => entry.subjectEmail === cee.email,
      'filtering by subject must keep exactly the acts about that person',
    );
    expect(aboutCee[0]?.actorEmail, 'the act about C was performed by B').toBe(bee.email);
  });

  it('AC-3: filters AND together, including a pair that can match nothing', async () => {
    const { tenantId, founder, bee, cee, projectId } = await fixture();

    await expectFilterKeeps(
      { actor: founder.email, subject: bee.email },
      (entry) => entry.actorEmail === founder.email && entry.subjectEmail === bee.email,
      'actor and subject must AND together',
    );
    await expectFilterKeeps(
      { type: ASSIGN_PARTICIPANT_ROLE, actor: bee.email, subject: cee.email },
      (entry) =>
        entry.actType === ASSIGN_PARTICIPANT_ROLE &&
        entry.actorEmail === bee.email &&
        entry.subjectEmail === cee.email,
      'all three filters must AND together',
    );

    // Both halves match acts; no act matches both. An OR would answer three.
    const ctx = await ctxFor(tenantId, founder);
    const beeAboutBee = await actLog(ctx, { projectId, actor: bee.email, subject: bee.email });
    expect(
      beeAboutBee,
      `B performed no act about B, but the log answered ${said(beeAboutBee)}`,
    ).toHaveLength(0);
  });

  it('AC-3: the explorer is per project — a sibling project’s acts are not in this one’s log', async () => {
    const { tenantId, founder, projectId, otherProjectId } = await fixture();
    const ctx = await ctxFor(tenantId, founder);
    const here = await actLog(ctx, { projectId });
    const there = await actLog(ctx, { projectId: otherProjectId });

    // The sibling holds its own founding grant and nothing of this project's log: each read is
    // the act rows of the project it names (R-SPINE-081's "per project").
    expect(there.length, `the sibling project's log is empty — ${said(there)}`).toBe(
      (await rowsFor('acts', otherProjectId)).length,
    );
    expect(there.length, 'a founded project has at least its founding act').toBeGreaterThanOrEqual(1);
    const ids = idsOf(here);
    for (const entry of there) {
      expect(ids.has(entry.actId), 'the two projects’ logs share an act').toBe(false);
    }
  });
});

/* ─────────────────── L-ACT-01 — reading the log writes nothing to it ─────────────────── */

describe('L-ACT-01 — actLog is a reader', () => {
  it('AC-2: calling actLog, filtered and unfiltered, appends no act', async () => {
    const { tenantId, founder, projectId } = await fixture();
    const before = await rowsFor('acts', projectId);
    const ctx = await ctxFor(tenantId, founder);

    await actLog(ctx, { projectId });
    await actLog(ctx, { projectId, type: ASSIGN_PARTICIPANT_ROLE });
    await actLog(ctx, { projectId, actor: founder.email, subject: founder.email });

    const after = await rowsFor('acts', projectId);
    expect(
      after.length,
      `reading the log appended ${after.length - before.length} act(s) to it`,
    ).toBe(before.length);
  });

  it('AC-2: a ctx for another workspace reads no rows of this project’s log', async () => {
    const { otherTenantId, outsider, projectId } = await fixture();
    // Loaded outside the `try`, so a module that is not there yet says so plainly instead of
    // being reported as "it threw" by the catch below.
    fn(await product(AUDIT_MODULE), 'actLog', AUDIT_MODULE);
    const ctx = await ctxFor(otherTenantId, outsider);
    let answered: readonly Entry[] | 'threw' = 'threw';
    try {
      answered = await actLog(ctx, { projectId });
    } catch {
      // A refusal is not the contract's answer here: AC-5's words are "answers an empty list
      // for that foreign projectId rather than rows or a throw".
    }
    expect(
      answered,
      'a foreign tenant’s ctx did not answer an empty list for a project it cannot see',
    ).toEqual([]);
  });
});
