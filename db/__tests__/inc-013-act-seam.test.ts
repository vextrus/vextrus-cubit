/**
 * inc-013 — the act seam, on live PostgreSQL (SEAM-ACT, L-ACT-01, L-ACT-02, L-ACT-03, V-DB).
 *
 * V-DB names "act-seam transactionality, composite FKs, append-only grants" and this file is
 * where those three stop being annotations. Every claim below reaches a real database through
 * SEAM-TENANT's own handles, because the guarantees are the database's:
 *
 *   - AC-3, transactionality. L-ACT-01: "act row and state change commit in one transaction or
 *     neither". The honest proof is a *failed* write, and the failure has to be one the seam
 *     cannot see coming — so a trigger is installed on `participant_roles` as the migrate role
 *     and the state half is made to raise underneath a commit the seam believes in. A pool that
 *     hands each statement of a "transaction" its own connection keeps the act row and drops
 *     the state row; a data-modifying CTE keeps neither. Both counts are read afterwards.
 *   - AC-4, the permission check. It lives in the seam and cuts on the actor's *current*
 *     participant role, so it is proven with three actors and one call: a MEASURER, a person
 *     with no participation at all, and the PRINCIPAL who may.
 *   - AC-5, the digest. L-ACT-02: "a commit whose digest is not the one current state produces
 *     refuses CONSEQUENCES_NOT_CARRIED".
 *
 * The suite lives in db/__tests__ and runs as `pnpm test:db db/__tests__/inc-013-act-seam.test.ts`:
 * the root vitest config excludes this directory, because `pnpm verify` runs without a
 * provisioned database.
 *
 * Two conventions this file follows deliberately:
 *
 *   - every product module is loaded by an absolute path assembled at run time. A literal
 *     `import '../../src/core/acts'` is resolved while the file is transformed, so on the day
 *     the module does not exist vite fails the whole file and vitest reports "0 test" — no
 *     failing assertion at all;
 *   - the act's input carries the proposed role under both `role` and `proposedRole`, with the
 *     same value. The Increment Spec fixes the Consequence's member names and leaves the
 *     input's to the seam, so the call is written to read either way; an input schema that
 *     refuses unknown keys has to accept both.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO } from './support/lanes';
import { APP_ROLE, MIGRATE_ROLE, connectAs, endAll, query } from './support/live';
import { renderOffence, scanActLog } from './support/act-log-scan';
import type { Offence, SourceModule } from './support/act-log-scan';
import type { Client } from 'pg';

/* ─────────────────────────────── what the spec names ────────────────────────────────── */

const ACTS_SEAM = 'src/core/acts';
const DB_SEAM = 'src/core/db';
const RULESET_SEED = 'src/core/rulesets/seed';

/** AC-3 names this file as the Builder's own half of the sole-writer claim. */
const BUILDER_LANE_TEST = 'db/__tests__/acts.test.ts';

const ASSIGN_PARTICIPANT_ROLE = 'ASSIGN_PARTICIPANT_ROLE';
const ADMINISTER_PROJECT = 'ADMINISTER_PROJECT';
const PRINCIPAL = 'PRINCIPAL';
const MEASURER = 'MEASURER';

/** L-ACT-01's three tables: the log, and the participation the log's composite FK points at. */
const ACT_TABLES: readonly string[] = ['acts', 'participants', 'participant_roles'];

/** AC-3 / B-05: append-only is a grant. What `cubit_app` holds, and what it must not. */
const HELD: readonly string[] = ['select', 'insert'];
const WITHHELD: readonly string[] = ['update', 'delete'];

const CONSEQUENCES_NOT_CARRIED = 'CONSEQUENCES_NOT_CARRIED';
const PERMISSION_NOT_HELD = 'PERMISSION_NOT_HELD';

/** AC-5: "a 64-character lowercase hex string". */
const HEX64 = /^[0-9a-f]{64}$/;

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

/* ───────────────────────────── the seam, and a way to read past it ──────────────────── */

interface ScopedHandle {
  execute: (statement: unknown) => Promise<unknown>;
}

interface DbSeam {
  readonly forTenant: (ctx: { tenantId: string }) => ScopedHandle;
  readonly runAsSystem: (reason: string) => ScopedHandle;
  readonly closeDb?: () => Promise<void>;
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
 * claim reads what the seam did — and what it did not do — without going back through it.
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

/** The owner, for the catalogue reads and for the induced failure of AC-3. */
let ownerOnce: Promise<Client> | undefined;

function ownerClient(): Promise<Client> {
  ownerOnce ??= (async () => {
    const client = await connectAs(MIGRATE_ROLE);
    openClients.push(client);
    return client;
  })();
  return ownerOnce;
}

/** How many rows of `table` this project has, read outside the seam. */
async function rowsFor(table: string, projectId: string): Promise<number> {
  const client = await systemClient();
  const rows = await query(
    client,
    `select count(*)::int as n from public."${table}" where project_id = $1`,
    [projectId],
  );
  return Number(rows[0]?.['n'] ?? -1);
}

/** The act log and the role history of one project, as a pair — what "or neither" is read on. */
async function ledgerOf(projectId: string): Promise<{ acts: number; roles: number }> {
  return { acts: await rowsFor('acts', projectId), roles: await rowsFor('participant_roles', projectId) };
}

/* ──────────────────────────────── the act seam's own surface ────────────────────────── */

interface ActCtx {
  readonly db: unknown;
  readonly tenantId: string;
  readonly actorId: string;
}

interface Previewed {
  readonly consequence: Record<string, unknown>;
  readonly digest: string;
}

interface ActSeam {
  readonly previewAct: (ctx: ActCtx, actType: string, input: unknown) => Promise<Previewed>;
  readonly commitAct: (
    ctx: ActCtx,
    actType: string,
    input: unknown,
    digest: string,
  ) => Promise<{ readonly actId: string }>;
  readonly foundPrincipal: (ctx: ActCtx, projectId: string) => Promise<unknown>;
  readonly listParticipantHistory: (
    ctx: ActCtx,
    projectId: string,
  ) => Promise<readonly Record<string, unknown>[]>;
  readonly ActSeamRefusal: CallableFunction;
  readonly ACT_TYPES: Record<string, unknown>;
}

let actSeamOnce: Promise<ActSeam> | undefined;

function actSeam(): Promise<ActSeam> {
  actSeamOnce ??= (async () => {
    const module = await importProduct(ACTS_SEAM);
    for (const name of ['previewAct', 'commitAct', 'foundPrincipal', 'listParticipantHistory']) {
      fn(module, name, ACTS_SEAM);
    }
    fn(module, 'ActSeamRefusal', ACTS_SEAM);
    expect(typeof module['ACT_TYPES'], `${ACTS_SEAM} exports no ACT_TYPES`).toBe('object');
    return module as unknown as ActSeam;
  })();
  return actSeamOnce;
}

/** The act's input, written so either spelling of the proposed role reads (see the header). */
const assignment = (projectId: string, userId: string, role: string): Record<string, unknown> => ({
  projectId,
  userId,
  role,
  proposedRole: role,
});

/* ─────────────────────────────── what a call did, and what it said ──────────────────── */

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
  if (outcome.ok) return `it succeeded and returned ${JSON.stringify(outcome.value)}`;
  const error = outcome.error as { code?: unknown; message?: unknown; stack?: unknown };
  return `[${String(error.code ?? '?')}] ${String(error.message ?? String(outcome.error))}`;
}

/**
 * A refusal from the seam, in the shape the Increment Spec fixes: an `ActSeamRefusal` carrying
 * `code`, and — for L-ACT-03's refusal — the act type and the permission that was missing.
 * "Refused" is the class *and* the code: an ordinary Error whose message happens to contain the
 * word would satisfy a looser reading and tell a caller nothing it can branch on.
 */
async function expectRefusal(
  outcome: Went,
  code: string,
  what: string,
): Promise<Record<string, unknown>> {
  expect(outcome.ok, `${what} was not refused — ${saidWhat(outcome)}`).toBe(false);
  const error = (outcome.ok ? {} : outcome.error) as Record<string, unknown>;
  const { ActSeamRefusal } = await actSeam();
  expect(
    error instanceof (ActSeamRefusal as unknown as new () => object),
    `${what} threw something that is not an ActSeamRefusal — ${saidWhat(outcome)}`,
  ).toBe(true);
  expect(String(error['code']), `${what} refused with the wrong code — ${saidWhat(outcome)}`).toBe(
    code,
  );
  return error;
}

/* ────────────────────────────────────── the fixture ─────────────────────────────────── */

interface Person {
  readonly userId: string;
  readonly email: string;
}

interface Fixture {
  readonly tenantId: string;
  readonly projectId: string;
  /** Founded PRINCIPAL by `foundPrincipal` — the actor who may perform the act. */
  readonly principal: Person;
  /** Assigned MEASURER: holds a role, and it does not bundle ADMINISTER_PROJECT. */
  readonly measurer: Person;
  /** No participation in this project at all. */
  readonly stranger: Person;
  /** Never yet a participant: what `currentRole: null` is proven on. */
  readonly newcomer: Person;
  /** Kept for AC-3's one successful commit, so no claim depends on another having run. */
  readonly outsider: Person;
  /** A user whose `participant_roles` INSERT the trigger of AC-3 refuses. */
  readonly cursed: Person;
}

let fixtureOnce: Promise<Fixture> | undefined;

/**
 * A tenant, four people and a pinned project whose creator is founded PRINCIPAL.
 *
 * Memoised into a promise each test awaits rather than built in `beforeAll`: a throwing
 * `beforeAll` reports its tests as skipped, and a skipped acceptance claim says nothing.
 */
function fixture(): Promise<Fixture> {
  fixtureOnce ??= (async () => {
    const { forTenant, runAsSystem } = await dbSeam();
    const system = await systemClient();

    const tenantRows = await query(
      system,
      'insert into public.tenants (slug, name) values ($1, $2) returning id',
      [`inc013-${RUN}`, `inc013 ${RUN}`],
    );
    const tenantId = String(tenantRows[0]?.['id'] ?? '');
    expect(tenantId, 'no tenant row').not.toBe('');

    const mint = async (label: string): Promise<Person> => {
      const email = `inc013-${RUN}-${label}@example.test`;
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

    const principal = await mint('principal');
    const measurer = await mint('measurer');
    const stranger = await mint('stranger');
    const newcomer = await mint('newcomer');
    const outsider = await mint('outsider');
    const cursed = await mint('cursed');

    // L-REG-07's own hook: a project is unrepresentable unpinned, so the fixture uses the
    // product's creator rather than an INSERT of its own.
    const seedModule = await importProduct(RULESET_SEED);
    const createPinnedProject = fn(seedModule, 'createPinnedProject', RULESET_SEED) as (
      handle: unknown,
      input: { tenantId: string; name: string; code: string },
    ) => Promise<{ projectId: string }>;
    const created = await createPinnedProject(forTenant({ tenantId }), {
      tenantId,
      name: `inc013 ${RUN}`,
      code: `INC013-${RUN}`,
    });
    const projectId = created.projectId;
    expect(projectId, 'createPinnedProject returned no projectId').toMatch(/^[0-9a-f-]{36}$/i);

    // The hook J-003 will compose into project creation: participants row, PRINCIPAL grant and
    // the founding act, in one transaction (R-SPINE-011, L-ACT-03).
    const { foundPrincipal, previewAct, commitAct } = await actSeam();
    const asPrincipal: ActCtx = {
      db: forTenant({ tenantId }),
      tenantId,
      actorId: principal.userId,
    };
    await foundPrincipal(asPrincipal, projectId);

    // A second participant who holds a role that is not ADMINISTER_PROJECT's (AC-4).
    const input = assignment(projectId, measurer.userId, MEASURER);
    const previewed = await previewAct(asPrincipal, ASSIGN_PARTICIPANT_ROLE, input);
    await commitAct(asPrincipal, ASSIGN_PARTICIPANT_ROLE, input, previewed.digest);

    // `runAsSystem` is touched here so its pool is the one this file closes, whichever handle
    // the seam reached the database through.
    expect(typeof runAsSystem('inc-013 fixture').execute).toBe('function');

    return { tenantId, projectId, principal, measurer, stranger, newcomer, outsider, cursed };
  })();
  return fixtureOnce;
}

/** A seam context for one person in the fixture's tenant — `db` from `forTenant` and nothing else. */
async function acting(person: Person): Promise<ActCtx> {
  const { forTenant } = await dbSeam();
  const { tenantId } = await fixture();
  return { db: forTenant({ tenantId }), tenantId, actorId: person.userId };
}

/* ──────────────────────────────────────── AC-4 ──────────────────────────────────────── */

describe('AC-4 — the permission check lives in the seam (L-ACT-03, SEAM-ACT)', () => {
  for (const who of ['measurer', 'stranger'] as const) {
    it(`AC-4: previewAct by the ${who} is refused PERMISSION_NOT_HELD, naming what is missing`, async () => {
      const found = await fixture();
      const { previewAct } = await actSeam();
      const ctx = await acting(found[who]);
      const before = await ledgerOf(found.projectId);

      const outcome = await went(() =>
        previewAct(ctx, ASSIGN_PARTICIPANT_ROLE, assignment(found.projectId, found.newcomer.userId, MEASURER)),
      );
      const refusal = await expectRefusal(outcome, PERMISSION_NOT_HELD, `previewAct by the ${who}`);
      // L-ACT-03: "`PERMISSION_NOT_HELD` carries the act type and missing permission."
      expect(String(refusal['actType']), 'the refusal does not name the act type').toBe(
        ASSIGN_PARTICIPANT_ROLE,
      );
      expect(String(refusal['missingPermission']), 'the refusal does not name the permission').toBe(
        ADMINISTER_PROJECT,
      );

      expect(await ledgerOf(found.projectId), 'a refused preview wrote a row').toEqual(before);
    });

    it(`AC-4: commitAct by the ${who} is refused PERMISSION_NOT_HELD, and writes no act`, async () => {
      const found = await fixture();
      const { commitAct } = await actSeam();
      const ctx = await acting(found[who]);
      const before = await ledgerOf(found.projectId);

      // The digest is beside the point: an actor who may not perform the act is refused before
      // any question about what state produces is asked.
      const outcome = await went(() =>
        commitAct(
          ctx,
          ASSIGN_PARTICIPANT_ROLE,
          assignment(found.projectId, found.newcomer.userId, MEASURER),
          'f'.repeat(64),
        ),
      );
      const refusal = await expectRefusal(outcome, PERMISSION_NOT_HELD, `commitAct by the ${who}`);
      expect(String(refusal['actType'])).toBe(ASSIGN_PARTICIPANT_ROLE);
      expect(String(refusal['missingPermission'])).toBe(ADMINISTER_PROJECT);

      expect(await ledgerOf(found.projectId), 'a refused commit wrote a row').toEqual(before);
    });
  }

  it('AC-4: the PRINCIPAL makes the identical call and it succeeds', async () => {
    // Non-vacuity: without this, every refusal above could be the seam refusing everybody.
    const found = await fixture();
    const { previewAct } = await actSeam();
    const ctx = await acting(found.principal);
    const previewed = await previewAct(
      ctx,
      ASSIGN_PARTICIPANT_ROLE,
      assignment(found.projectId, found.newcomer.userId, MEASURER),
    );
    expect(previewed.digest, 'the PRINCIPAL’s preview carried no digest').toMatch(HEX64);
  });

  it('AC-2 / SEAM-ACT: every act type the enum carries is one the seam answers for', async () => {
    // Ranged over ACT_TYPES rather than over today's one member: L-ACT-02's map is total, and a
    // later increment's act type has to reach the same check. Whoever holds no participation in
    // a project holds no permission in it, so every act type refuses this actor — a type the
    // seam did not recognise would resolve, or fail some other way entirely.
    const found = await fixture();
    const { ACT_TYPES, previewAct } = await actSeam();
    const types = Object.keys(ACT_TYPES);
    expect(types.length, 'ACT_TYPES is empty, so ranging over it proves nothing').toBeGreaterThan(0);
    const ctx = await acting(found.stranger);
    for (const actType of types) {
      const outcome = await went(() =>
        previewAct(ctx, actType, assignment(found.projectId, found.newcomer.userId, MEASURER)),
      );
      expect(
        outcome.ok,
        `previewAct(${actType}) by somebody with no participation returned instead of refusing — ${saidWhat(outcome)}`,
      ).toBe(false);
    }
  });
});

/* ──────────────────────────────────────── AC-5 ──────────────────────────────────────── */

describe('AC-5 — the Consequence and its digest (L-ACT-02)', () => {
  it('AC-5: previewAct returns the typed Consequence and a 64-char lowercase hex digest', async () => {
    const found = await fixture();
    const { previewAct } = await actSeam();
    const ctx = await acting(found.principal);
    const before = await ledgerOf(found.projectId);

    const previewed = await previewAct(
      ctx,
      ASSIGN_PARTICIPANT_ROLE,
      assignment(found.projectId, found.newcomer.userId, MEASURER),
    );

    const consequence = previewed.consequence;
    expect(consequence, 'previewAct returned no consequence').toBeDefined();
    expect(consequence['projectId']).toBe(found.projectId);
    expect(consequence['userId']).toBe(found.newcomer.userId);
    expect(consequence['tenantId']).toBe(found.tenantId);
    // "currentRole — null when the user is not yet a participant": null, and not undefined or
    // an empty string, because the dialog that renders it branches on the difference.
    expect(consequence['currentRole'], 'a newcomer’s currentRole is not null').toBeNull();
    expect(consequence['proposedRole']).toBe(MEASURER);
    // The project has one PRINCIPAL and this act does not touch them.
    expect(consequence['principalsAfter'], 'principalsAfter is not a count').toBe(1);

    expect(previewed.digest).toMatch(HEX64);
    // L-ACT-01: a preview is a read. Nothing about it is an act.
    expect(await ledgerOf(found.projectId), 'previewAct wrote a row').toEqual(before);
  });

  it('AC-5: equal Consequences carry equal digests', async () => {
    const found = await fixture();
    const { previewAct } = await actSeam();
    const ctx = await acting(found.principal);
    const input = assignment(found.projectId, found.newcomer.userId, MEASURER);
    const first = await previewAct(ctx, ASSIGN_PARTICIPANT_ROLE, input);
    const again = await previewAct(ctx, ASSIGN_PARTICIPANT_ROLE, input);
    expect(again.consequence).toEqual(first.consequence);
    expect(again.digest, 'the same Consequence digested two different ways').toBe(first.digest);
  });

  it('AC-5: a commit whose digest current state does not produce refuses, and writes nothing', async () => {
    const found = await fixture();
    const { commitAct } = await actSeam();
    const ctx = await acting(found.principal);
    const before = await ledgerOf(found.projectId);

    const outcome = await went(() =>
      commitAct(
        ctx,
        ASSIGN_PARTICIPANT_ROLE,
        assignment(found.projectId, found.newcomer.userId, MEASURER),
        // Well-formed and foreign: the shape is right, the state it describes is not this one.
        'a'.repeat(64),
      ),
    );
    await expectRefusal(outcome, CONSEQUENCES_NOT_CARRIED, 'a commit carrying a foreign digest');
    expect(await ledgerOf(found.projectId), 'the refused commit wrote a row').toEqual(before);
  });

  it('AC-5: the digest previewAct just returned commits', async () => {
    const found = await fixture();
    const { previewAct, commitAct, listParticipantHistory } = await actSeam();
    const ctx = await acting(found.principal);
    const input = assignment(found.projectId, found.newcomer.userId, MEASURER);
    const previewed = await previewAct(ctx, ASSIGN_PARTICIPANT_ROLE, input);
    const committed = await commitAct(ctx, ASSIGN_PARTICIPANT_ROLE, input, previewed.digest);
    expect(String(committed.actId), 'commitAct returned no actId').toMatch(/^[0-9a-f-]{36}$/i);

    // L-ACT-01, append-only: the history is what happened, in the order it happened.
    const history = await listParticipantHistory(ctx, found.projectId);
    const last = history[history.length - 1];
    expect(last?.['userId'], 'the newcomer’s grant is not the last thing that happened').toBe(
      found.newcomer.userId,
    );
    expect(last?.['role']).toBe(MEASURER);
    expect(last?.['actId'], 'the history row does not cite the act that made it').toBe(
      committed.actId,
    );
  });
});

/* ──────────────────────────────────────── AC-3 ──────────────────────────────────────── */

describe('AC-3 — act row and state change commit together or not at all (L-ACT-01, V-DB)', () => {
  it('AC-3: a successful commit leaves exactly one act and one grant, and they cite each other', async () => {
    const found = await fixture();
    const { previewAct, commitAct } = await actSeam();
    const ctx = await acting(found.principal);
    const before = await ledgerOf(found.projectId);

    const input = assignment(found.projectId, found.outsider.userId, PRINCIPAL);
    const previewed = await previewAct(ctx, ASSIGN_PARTICIPANT_ROLE, input);
    const committed = await commitAct(ctx, ASSIGN_PARTICIPANT_ROLE, input, previewed.digest);

    const after = await ledgerOf(found.projectId);
    expect(after.acts, 'the commit did not write exactly one act row').toBe(before.acts + 1);
    expect(after.roles, 'the commit did not write exactly one participant_roles row').toBe(
      before.roles + 1,
    );

    const system = await systemClient();
    const rows = await query(
      system,
      `select role, act_id, user_id from public.participant_roles where act_id = $1`,
      [committed.actId],
    );
    expect(rows.length, 'no participant_roles row cites the act that was returned').toBe(1);
    expect(String(rows[0]?.['user_id'])).toBe(found.outsider.userId);

    // The act is on this project, by this actor: L-ACT-03's composite FK is what makes that
    // a database fact rather than a convention.
    const actRows = await query(
      system,
      'select project_id, actor_id, act_type from public.acts where id = $1',
      [committed.actId],
    );
    expect(String(actRows[0]?.['project_id'])).toBe(found.projectId);
    expect(String(actRows[0]?.['actor_id'])).toBe(found.principal.userId);
  });

  it('AC-3: a commit whose state half fails leaves the act log exactly as it was', async () => {
    const found = await fixture();
    const { previewAct, commitAct } = await actSeam();
    const owner = await ownerClient();
    const ctx = await acting(found.principal);

    // The failure the seam cannot see coming, installed underneath it. A role value the seam
    // itself would reject proves nothing — it would never reach the database — so the refusal
    // is put on the state half's own INSERT, below the act insert of the same statement.
    await query(
      owner,
      `create or replace function public.inc013_refuse_state_half() returns trigger
         language plpgsql as $fn$
         begin
           raise exception 'inc-013: the state half of this act is refused';
         end
       $fn$`,
    );
    // `CREATE TRIGGER … WHEN` takes no parameters, so the id is interpolated. It is a UUID this
    // file minted, and it is cast rather than concatenated into a predicate that could mean
    // anything else.
    await query(
      owner,
      `create trigger inc013_refuse_state_half
         before insert on public.participant_roles
         for each row when (new.user_id = '${found.cursed.userId}'::uuid)
         execute function public.inc013_refuse_state_half()`,
    );

    try {
      const before = await ledgerOf(found.projectId);
      const input = assignment(found.projectId, found.cursed.userId, MEASURER);
      const previewed = await previewAct(ctx, ASSIGN_PARTICIPANT_ROLE, input);

      const outcome = await went(() =>
        commitAct(ctx, ASSIGN_PARTICIPANT_ROLE, input, previewed.digest),
      );
      expect(
        outcome.ok,
        `the commit reported success although its state half was refused — ${saidWhat(outcome)}`,
      ).toBe(false);

      const after = await ledgerOf(found.projectId);
      expect(
        after.acts,
        'the act row survived a commit whose state change was refused — L-ACT-01: "act row and ' +
          'state change commit in one transaction or neither"',
      ).toBe(before.acts);
      expect(after.roles, 'a participant_roles row survived its own refusal').toBe(before.roles);
    } finally {
      await query(owner, 'drop trigger if exists inc013_refuse_state_half on public.participant_roles');
      await query(owner, 'drop function if exists public.inc013_refuse_state_half()');
    }
  });

  it('AC-3: the trigger really does refuse, so the claim above is not vacuous', async () => {
    // If the trigger never fired, "the counts did not move" would be true of a commit that was
    // simply refused earlier, or of no commit at all. This is the control.
    const found = await fixture();
    const owner = await ownerClient();
    // FORCEd row-level security binds the owner too, so this connection must carry a scope
    // before it can read or write a row — exactly as `systemClient()` does. Unscoped, the
    // INSERT … SELECT below would filter its source rows to none, affect nothing, and succeed
    // in silence: the per-row trigger would never fire and the control would prove the opposite
    // of what it claims. DDL and the catalogue reads elsewhere on this connection do not depend
    // on the setting.
    await query(owner, "select set_config('cubit.scope', 'system', false)");
    await query(
      owner,
      `create or replace function public.inc013_probe_refusal() returns trigger
         language plpgsql as $fn$ begin raise exception 'inc-013 probe'; end $fn$`,
    );
    await query(
      owner,
      `create trigger inc013_probe_refusal before insert on public.participant_roles
         for each row when (new.user_id = '${found.cursed.userId}'::uuid)
         execute function public.inc013_probe_refusal()`,
    );
    try {
      const outcome = await went(() =>
        query(
          owner,
          `insert into public.participant_roles (tenant_id, project_id, user_id, role, act_id)
             select tenant_id, project_id, $1, role, act_id from public.participant_roles limit 1`,
          [found.cursed.userId],
        ),
      );
      expect(outcome.ok, 'the trigger did not refuse an INSERT it was written to refuse').toBe(false);
      expect(saidWhat(outcome)).toContain('inc-013 probe');
    } finally {
      await query(owner, 'drop trigger if exists inc013_probe_refusal on public.participant_roles');
      await query(owner, 'drop function if exists public.inc013_probe_refusal()');
    }
  });
});

/* ──────────────────────── AC-3, second half: the seam is the sole writer ─────────────── */

const SKIP_DIRS = new Set(['node_modules', 'out', 'dist', 'coverage', 'test-results', 'cad']);

function walk(dir: string): string[] {
  const absolute = at(dir);
  if (!existsSync(absolute)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...walk(child));
    else if (child.endsWith('.ts') || child.endsWith('.tsx')) found.push(child);
  }
  return found;
}

const read = (relative: string): string => readFileSync(at(relative), 'utf8');

/**
 * The corpus the scan runs over: every product module in the tree. Chains are followed through
 * db/ as well as src/, because a re-export can run through a module that is innocent itself; the
 * scanner grades only what AC-3 asks about.
 */
const corpus = (): SourceModule[] =>
  [...walk('src'), ...walk('db')].map((relative) => ({ path: relative, text: read(relative) }));

/**
 * The shapes the scanner must catch before its silence on the real tree means anything. This is
 * the codebase's own idiomatic write — `db.insert(acts).values(…)` over a binding reached by a
 * re-export chain — plus the two shapes an earlier pair of regexes recognised, and two innocent
 * modules that must stay unflagged (a relational *read*, and the tRPC namespace that is called
 * `acts` without being a writer).
 */
const FIXTURE: readonly SourceModule[] = [
  { path: 'db/schema/spine/acts.ts', text: "export const acts = pgTable('acts', { id: uuid() });" },
  { path: 'db/schema/index.ts', text: "export * from './spine/acts';" },
  // The re-export chain: an ordinary-looking module hands the table object on under its own name.
  { path: 'src/modules/x/tables.ts', text: "export { acts } from '../../../db/schema';" },
  {
    path: 'src/modules/x/writer.ts',
    text:
      "import { acts } from './tables';\n" +
      'export async function grant(db) { await db.insert(acts).values({ id }); }\n',
  },
  { path: 'src/modules/x/fuller.ts', text: 'const t = db._.fullSchema.participantRoles;\n' },
  { path: 'src/modules/x/rawsql.ts', text: 'await db.execute(sql`insert into public.acts (id) values (1)`);\n' },
  { path: 'src/modules/x/reader.ts', text: 'export const read = (tx) => tx.query.acts.findMany();\n' },
  {
    path: 'src/server/routers/acts.ts',
    text: "export const actsRouter = router({ assignParticipantRole: actPair(preview, commit) });\n",
  },
];

const offendersIn = (result: { offences: readonly Offence[] }): string[] => [
  ...new Set(result.offences.map((offence) => offence.path)),
];

describe('AC-3 / L-ACT-01 — the act seam is the sole writer of the log', () => {
  it('AC-3: nothing under src/ outside src/core/acts reaches the three tables to write them', async () => {
    // ── first, the inversion. A scanner that certifies only the shapes it already handles is how
    // the gap the arbitration found stayed hidden: the empty verdict below is worth exactly what
    // this fixture proves. Every assertion here is about the scanner, not about the tree.
    const proof = scanActLog(FIXTURE);
    const caught = offendersIn(proof);
    expect(
      caught,
      'the scanner does not catch a re-export chain, so its verdict on the real tree is worthless',
    ).toContain('src/modules/x/tables.ts');
    expect(
      caught,
      'the scanner does not catch `db.insert(acts).values(…)` over a re-exported binding — the ' +
        'codebase’s own idiomatic write',
    ).toContain('src/modules/x/writer.ts');
    expect(
      proof.offences.filter((o) => o.path === 'src/modules/x/writer.ts').map((o) => o.what).join(' | '),
    ).toMatch(/insert/i);
    expect(caught, 'the scanner does not catch a read off _.fullSchema').toContain(
      'src/modules/x/fuller.ts',
    );
    expect(caught, 'the scanner does not catch a raw-SQL insert').toContain('src/modules/x/rawsql.ts');
    // …and it is not simply flagging everything: a relational read holds no table object, and a
    // tRPC namespace that happens to be called `acts` writes nothing.
    expect(caught, 'a relational read through tx.query.acts is not a write').not.toContain(
      'src/modules/x/reader.ts',
    );
    expect(caught, 'the tRPC namespace named `acts` is not a writer of the log').not.toContain(
      'src/server/routers/acts.ts',
    );

    // ── and the same, planted into the *real* corpus, so the verdict below cannot be vacuous
    // through the tree's own schema barrel: the bindings must be found where they are declared
    // and must travel every edge that actually exists in this repo.
    const tree = corpus();
    const planted: SourceModule[] = [
      { path: 'src/modules/planted/tables.ts', text: "export { acts } from '../../../db/schema';\n" },
      {
        path: 'src/modules/planted/writer.ts',
        text:
          "import { acts } from './tables';\n" +
          'export const grant = (db) => db.insert(acts).values({ id });\n',
      },
    ];
    const plantedCaught = offendersIn(scanActLog([...tree, ...planted]));
    expect(
      plantedCaught,
      'a module that re-exports `acts` from the tree’s own db/schema barrel went unnoticed, so ' +
        'the empty verdict below proves nothing about the real tree',
    ).toContain('src/modules/planted/tables.ts');
    expect(
      plantedCaught,
      'a `db.insert(acts).values(…)` reached through that re-export went unnoticed',
    ).toContain('src/modules/planted/writer.ts');

    // ── now the tree itself. L-ACT-01: "the sole writer of the log and unimportable elsewhere" —
    // no module outside the seam may hold a binding to the three tables by any import or
    // re-export chain, nor write them in SQL text or as a builder statement.
    const { offences, holders } = scanActLog(tree);
    const declared = new Set<string>();
    for (const [path, bindings] of holders) {
      if (!path.startsWith('db/schema/')) continue;
      for (const table of bindings.values()) declared.add(table);
    }
    for (const table of ACT_TABLES) {
      expect(
        [...declared],
        `no module under db/schema declares the ${table} table, so the scan below has nothing to ` +
          'look for — the tables have moved, or the declaration no longer reads as one',
      ).toContain(table);
    }
    expect(
      offences.map(renderOffence),
      'L-ACT-01: the act seam "is the sole writer of the log and unimportable elsewhere". ' +
        'These modules reach the act log’s tables',
    ).toEqual([]);
  });

  it('AC-3 / B-05: cubit_app holds SELECT and INSERT on all three tables, and neither UPDATE nor DELETE', async () => {
    await fixture();
    const owner = await ownerClient();
    for (const table of ACT_TABLES) {
      for (const privilege of HELD) {
        const [row] = await query(owner, 'select has_table_privilege($1, $2, $3) as granted', [
          APP_ROLE,
          `public.${table}`,
          privilege,
        ]);
        expect(row?.['granted'], `${APP_ROLE} cannot ${privilege} public.${table}`).toBe(true);
      }
      for (const privilege of WITHHELD) {
        const [row] = await query(owner, 'select has_table_privilege($1, $2, $3) as granted', [
          APP_ROLE,
          `public.${table}`,
          privilege,
        ]);
        expect(
          row?.['granted'],
          `${APP_ROLE} holds ${privilege} on public.${table} — an act that happened could be ` +
            'edited into one that did not (L-ACT-01, B-05)',
        ).toBe(false);
      }
    }
  });

  it('AC-3: the Builder’s own lane test for the act tables is in the tree', () => {
    // AC-3 names it. This file proves the property; that one is where the module's owner keeps
    // its own reading of it, and an increment that shipped without it shipped half the claim.
    expect(existsSync(at(BUILDER_LANE_TEST)), `${BUILDER_LANE_TEST} is not in the tree`).toBe(true);
  });
});
