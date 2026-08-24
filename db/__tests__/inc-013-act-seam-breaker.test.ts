/**
 * inc-013 — the act seam under concurrency and under malformed input (L-ACT-03, SEAM-ACT, V-DB).
 *
 * The Verifier's acceptance proves the last-PRINCIPAL guard *sequentially*: one caller demotes,
 * the seam recomputes the Consequence, and the guard reads `principalsAfter: 0` and refuses.
 * This file asks the same question of two callers at once, which is the shape L-ACT-03's
 * sentence is actually about — "the last PRINCIPAL cannot be removed" is a claim about the
 * project's state, not about one request's arithmetic.
 *
 * The seam reads the roles (`select distinct on (user_id) …`, no lock) and then writes in a
 * *second* statement. SEAM-TENANT wraps each statement in a transaction of its own, so nothing
 * holds a row between the read and the write and nothing serialises the two callers. Two
 * PRINCIPALs demoting each other therefore both read "two principals, one would remain", both
 * pass the guard, and both write — and the project is left with none. Nobody can then perform
 * `ASSIGN_PARTICIPANT_ROLE` on it ever again, because the permission it needs
 * (`ADMINISTER_PROJECT`) is bundled by `PRINCIPAL` alone: the project is bricked, and the log
 * being append-only means there is no way back.
 *
 * Runs as `pnpm test:db db/__tests__/inc-013-act-seam-breaker.test.ts`. Conventions are the
 * acceptance file's: product modules are loaded by an absolute path assembled at run time (a
 * literal import of a module that is not there makes vitest report "0 test" rather than a
 * failing claim), and the act's input carries the proposed role under both spellings.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO } from './support/lanes';
import { APP_ROLE, connectAs, endAll, query } from './support/live';
import type { Client } from 'pg';

const ACTS_SEAM = 'src/core/acts';
const DB_SEAM = 'src/core/db';
const RULESET_SEED = 'src/core/rulesets/seed';

const ASSIGN_PARTICIPANT_ROLE = 'ASSIGN_PARTICIPANT_ROLE';
const PRINCIPAL = 'PRINCIPAL';
const MEASURER = 'MEASURER';

const RUN = randomUUID().slice(0, 8);

/* ────────────────────────────────── loading the product ─────────────────────────────── */

const at = (relative: string): string => join(REPO, ...relative.split('/'));

async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const base = at(relative);
  const found = [base, `${base}.ts`, join(base, 'index.ts')].find((path) => existsSync(path));
  if (found === undefined) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(found).href)) as Record<string, unknown>;
}

interface ScopedHandle {
  execute: (statement: unknown) => Promise<unknown>;
}

interface DbSeam {
  readonly forTenant: (ctx: { tenantId: string }) => ScopedHandle;
  readonly closeDb?: () => Promise<void>;
}

interface ActCtx {
  readonly db: unknown;
  readonly tenantId: string;
  readonly actorId: string;
}

interface ActSeam {
  readonly previewAct: (
    ctx: ActCtx,
    actType: string,
    input: unknown,
  ) => Promise<{ readonly consequence: Record<string, unknown>; readonly digest: string }>;
  readonly commitAct: (
    ctx: ActCtx,
    actType: string,
    input: unknown,
    digest: string,
  ) => Promise<{ readonly actId: string }>;
  readonly foundPrincipal: (ctx: ActCtx, projectId: string) => Promise<unknown>;
  readonly ActSeamRefusal: CallableFunction;
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

let actSeamOnce: Promise<ActSeam> | undefined;

function actSeam(): Promise<ActSeam> {
  actSeamOnce ??= (async () =>
    (await importProduct(ACTS_SEAM)) as unknown as ActSeam)();
  return actSeamOnce;
}

/**
 * A connection that sees every tenant's rows — FORCEd RLS binds the owner too, so state is read
 * back through a `system`-scoped app connection rather than around the policy.
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

const assignment = (projectId: string, userId: string, role: string): Record<string, unknown> => ({
  projectId,
  userId,
  role,
  proposedRole: role,
});

/* ────────────────────────────────────── the fixture ─────────────────────────────────── */

interface Person {
  readonly userId: string;
  readonly email: string;
}

let tenantOnce: Promise<string> | undefined;

function tenant(): Promise<string> {
  tenantOnce ??= (async () => {
    const system = await systemClient();
    const rows = await query(
      system,
      'insert into public.tenants (slug, name) values ($1, $2) returning id',
      [`brk013-${RUN}`, `brk013 ${RUN}`],
    );
    const tenantId = String(rows[0]?.['id'] ?? '');
    expect(tenantId, 'no tenant row').not.toBe('');
    return tenantId;
  })();
  return tenantOnce;
}

let minted = 0;

async function mint(label: string): Promise<Person> {
  const tenantId = await tenant();
  const system = await systemClient();
  minted += 1;
  const email = `brk013-${RUN}-${label}-${minted}@example.test`;
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
}

/** L-REG-07: a project is unrepresentable unpinned, so the product's own creator makes it. */
async function pinnedProject(label: string): Promise<string> {
  const tenantId = await tenant();
  const { forTenant } = await dbSeam();
  const seedModule = await importProduct(RULESET_SEED);
  const createPinnedProject = seedModule['createPinnedProject'] as (
    handle: unknown,
    input: { tenantId: string; name: string; code: string },
  ) => Promise<{ projectId: string }>;
  const created = await createPinnedProject(forTenant({ tenantId }), {
    tenantId,
    name: `brk013 ${label}`,
    code: `BRK013-${label}`.slice(0, 32),
  });
  return created.projectId;
}

async function acting(person: Person): Promise<ActCtx> {
  const { forTenant } = await dbSeam();
  const tenantId = await tenant();
  // A handle of its own per actor: two browser tabs are two requests, and each request builds
  // its own `forTenant` handle. Sharing one here would prove less than the product does.
  return { db: forTenant({ tenantId }), tenantId, actorId: person.userId };
}

/** Everybody's current role on a project — the last grant of each (project, user) pair. */
async function currentRoles(projectId: string): Promise<Map<string, string>> {
  const system = await systemClient();
  const rows = await query(
    system,
    `select distinct on (user_id) user_id, role
       from public.participant_roles
      where project_id = $1
      order by user_id, created_at desc, id desc`,
    [projectId],
  );
  const held = new Map<string, string>();
  for (const row of rows) held.set(String(row['user_id']), String(row['role']));
  return held;
}

async function principalCount(projectId: string): Promise<number> {
  let principals = 0;
  for (const role of (await currentRoles(projectId)).values()) {
    if (role === PRINCIPAL) principals += 1;
  }
  return principals;
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
  if (outcome.ok) return `succeeded → ${JSON.stringify(outcome.value)}`;
  const error = outcome.error as { code?: unknown; message?: unknown };
  return `[${String(error.code ?? '?')}] ${String(error.message ?? String(outcome.error))}`;
}

/* ───────────────────────── a project with two principals, per round ─────────────────── */

interface Duel {
  readonly projectId: string;
  readonly first: Person;
  readonly second: Person;
}

/**
 * A fresh project founded by one PRINCIPAL who then promotes a second — the state R-SPINE-011's
 * "last PRINCIPAL protected" is one act away from on either side.
 */
async function twoPrincipals(label: string): Promise<Duel> {
  const { foundPrincipal, previewAct, commitAct } = await actSeam();
  const first = await mint(`p1-${label}`);
  const second = await mint(`p2-${label}`);
  const projectId = await pinnedProject(label);

  const asFirst = await acting(first);
  await foundPrincipal(asFirst, projectId);

  const promote = assignment(projectId, second.userId, PRINCIPAL);
  const previewed = await previewAct(asFirst, ASSIGN_PARTICIPANT_ROLE, promote);
  await commitAct(asFirst, ASSIGN_PARTICIPANT_ROLE, promote, previewed.digest);

  expect(await principalCount(projectId), `${label}: the fixture did not reach two principals`).toBe(
    2,
  );
  return { projectId, first, second };
}

/* ──────────────────────────────────────── the claims ────────────────────────────────── */

describe('L-ACT-03 — "the last PRINCIPAL cannot be removed", under two callers at once', () => {
  /**
   * The control, and the reading the acceptance already settled: one caller at a time reaches
   * the guard, so a project never falls below one PRINCIPAL when the two acts are sequenced.
   *
   * It runs first so that the concurrent claim below cannot be read as "the guard does not
   * work" — it does; it is simply not enforced against a second caller.
   */
  it('control: sequenced, the second demotion is refused and one PRINCIPAL remains', async () => {
    const { previewAct, commitAct } = await actSeam();
    const duel = await twoPrincipals('seq');
    const asFirst = await acting(duel.first);
    const asSecond = await acting(duel.second);

    const firstDemotesSecond = assignment(duel.projectId, duel.second.userId, MEASURER);
    const secondDemotesFirst = assignment(duel.projectId, duel.first.userId, MEASURER);

    const previewA = await previewAct(asFirst, ASSIGN_PARTICIPANT_ROLE, firstDemotesSecond);
    const previewB = await previewAct(asSecond, ASSIGN_PARTICIPANT_ROLE, secondDemotesFirst);
    expect(Number(previewA.consequence['principalsAfter'])).toBe(1);
    expect(Number(previewB.consequence['principalsAfter'])).toBe(1);

    await commitAct(asFirst, ASSIGN_PARTICIPANT_ROLE, firstDemotesSecond, previewA.digest);
    const second = await went(() =>
      commitAct(asSecond, ASSIGN_PARTICIPANT_ROLE, secondDemotesFirst, previewB.digest),
    );

    expect(second.ok, `the second sequenced demotion was not refused — ${saidWhat(second)}`).toBe(
      false,
    );
    expect(await principalCount(duel.projectId), 'the project lost its last principal').toBe(1);
  });

  /**
   * The defect. Two tabs, two `commitAct` calls issued in the same tick on handles of their own.
   * Each recomputes the Consequence before either has written, so each reads two principals and
   * each guard passes — and the project is left with none.
   *
   * Several rounds on fresh projects: the interleave is the ordinary one (both reads are round
   * trips issued together, and neither write has landed when the second read returns), and a
   * round that happens to serialise refuses the second demotion, which is the control's outcome
   * and not a failure. The claim is the invariant, asserted after every round: **a project always
   * has at least one PRINCIPAL.**
   */
  it('L-ACT-03: two concurrent demotions never leave a project with zero PRINCIPALs', async () => {
    const { previewAct, commitAct } = await actSeam();
    const rounds: string[] = [];

    for (let round = 0; round < 5; round += 1) {
      const duel = await twoPrincipals(`race${round}`);
      const asFirst = await acting(duel.first);
      const asSecond = await acting(duel.second);

      const firstDemotesSecond = assignment(duel.projectId, duel.second.userId, MEASURER);
      const secondDemotesFirst = assignment(duel.projectId, duel.first.userId, MEASURER);

      const previewA = await previewAct(asFirst, ASSIGN_PARTICIPANT_ROLE, firstDemotesSecond);
      const previewB = await previewAct(asSecond, ASSIGN_PARTICIPANT_ROLE, secondDemotesFirst);

      // Both in flight together — no await between them.
      const [wentA, wentB] = await Promise.all([
        went(() => commitAct(asFirst, ASSIGN_PARTICIPANT_ROLE, firstDemotesSecond, previewA.digest)),
        went(() =>
          commitAct(asSecond, ASSIGN_PARTICIPANT_ROLE, secondDemotesFirst, previewB.digest),
        ),
      ]);

      const principals = await principalCount(duel.projectId);
      rounds.push(
        `round ${round}: A ${saidWhat(wentA)} · B ${saidWhat(wentB)} → ${principals} principal(s)`,
      );

      expect(
        principals,
        `L-ACT-03: the project has no PRINCIPAL left, and ADMINISTER_PROJECT is bundled by ` +
          `PRINCIPAL alone — no act can ever restore one.\n${rounds.join('\n')}`,
      ).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('SEAM-ACT — a malformed project id is answered, not crashed into', () => {
  /**
   * `projectId` reaches `where project_id = $1` against a `uuid` column, and the router types it
   * `z.string()`. A caller who deep-links or hand-writes a project id that is not a uuid should
   * be told what a stranger is told — they take no part in a project — rather than receive the
   * driver's `22P02 invalid input syntax for type uuid`, which is neither a refusal a caller can
   * branch on nor something the seam should be spelling at a client.
   *
   * The seam already refuses an *empty* project id deliberately (a `TypeError` from
   * `projectOf`), so the shape of the answer is settled; what is missing is the case where the
   * string is non-empty and not a uuid.
   */
  it('previewAct with a non-uuid projectId refuses rather than raising the driver error', async () => {
    const { previewAct } = await actSeam();
    const stranger = await mint('malformed');
    const ctx = await acting(stranger);
    const target = await mint('malformed-subject');

    const outcome = await went(() =>
      previewAct(ctx, ASSIGN_PARTICIPANT_ROLE, assignment('not-a-uuid', target.userId, MEASURER)),
    );

    expect(outcome.ok, `a non-uuid projectId was accepted — ${saidWhat(outcome)}`).toBe(false);

    // The seam's own two kinds of answer: a refusal a caller can branch on, or the `TypeError`
    // `projectOf` already raises for an input that names no project. Anything else is the driver
    // speaking through the seam — today a `DrizzleQueryError` wrapping `22P02 invalid input
    // syntax for type uuid`, which `refusalCodeOf` does not recognise, so `src/server/routers/
    // acts.ts` rethrows it and the caller is told the server broke.
    const { ActSeamRefusal } = await actSeam();
    const error = outcome.ok ? {} : (outcome.error as object);
    const mine =
      error instanceof (ActSeamRefusal as unknown as new () => object) ||
      error instanceof TypeError;
    expect(
      mine,
      `the seam let the driver answer a malformed projectId — ` +
        `${error.constructor.name}: ${saidWhat(outcome)}`,
    ).toBe(true);
  });
});
