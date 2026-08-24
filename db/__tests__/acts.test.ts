/**
 * The act seam's own lane test (SEAM-ACT, L-ACT-01, L-ACT-03, V-DB).
 *
 * `db/__tests__/inc-013-act-seam.test.ts` proves the increment's acceptance; this file is where
 * the module's owner keeps its own reading of the same law, and it is deliberately about the
 * things the *database* enforces rather than the things the seam decides:
 *
 *   - L-ACT-03: "Participation is a composite FK from the act log." An act on a project by
 *     somebody who takes no part in it is refused by Postgres, not by a check in TypeScript —
 *     so a future act type that forgets to look cannot write one either.
 *   - L-ACT-01, append-only: `cubit_app` is refused UPDATE and DELETE outright, so a demotion
 *     is a new row and the history of who held what stays answerable after the fact.
 *   - the participation's unique key: a second grant to the same person is a second *role*, not
 *     a second participation.
 *   - "the sole writer of the log and unimportable elsewhere": the drizzle table objects for the
 *     three tables are reached from nowhere under `src/` outside `src/core/acts/`.
 *
 * Product modules are loaded by an absolute path assembled at run time: a literal import of a
 * module that is not in the tree is resolved while this file is transformed, and vitest then
 * reports "0 test" rather than a failing claim.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO } from './support/lanes';
import { APP_ROLE, INSUFFICIENT_PRIVILEGE, connectAs, endAll, query } from './support/live';
import type { Client } from 'pg';

const ACTS_SEAM = 'src/core/acts';
const DB_SEAM = 'src/core/db';
const RULESET_SEED = 'src/core/rulesets/seed';

const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';

const RUN = randomUUID().slice(0, 8);

const at = (relative: string): string => join(REPO, ...relative.split('/'));

async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const base = at(relative);
  const found = [base, `${base}.ts`, join(base, 'index.ts')].find((path) => existsSync(path));
  if (found === undefined) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(found).href)) as Record<string, unknown>;
}

/* ─────────────────────────────────── the live fixture ───────────────────────────────── */

interface ScopedHandle {
  execute: (statement: unknown) => Promise<unknown>;
}

interface ActCtx {
  readonly db: unknown;
  readonly tenantId: string;
  readonly actorId: string;
}

interface Seam {
  readonly forTenant: (ctx: { tenantId: string }) => ScopedHandle;
  readonly closeDb?: () => Promise<void>;
}

const openClients: Client[] = [];
let closeSeam: (() => Promise<void>) | undefined;

afterAll(async () => {
  await endAll(openClients);
  openClients.length = 0;
  if (closeSeam !== undefined) await closeSeam().catch(() => undefined);
});

/** A connection that sees every tenant's rows — how a claim reads what the seam did. */
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

interface Fixture {
  readonly tenantId: string;
  readonly projectId: string;
  readonly principalId: string;
  readonly memberId: string;
  /** Never a participant of the project: what the composite FK is proven on. */
  readonly outsiderId: string;
  readonly ctx: ActCtx;
}

interface ActsSeam {
  readonly foundPrincipal: (ctx: ActCtx, projectId: string) => Promise<{ actId: string }>;
  readonly previewAct: (
    ctx: ActCtx,
    actType: string,
    input: unknown,
  ) => Promise<{ digest: string; consequence: Record<string, unknown> }>;
  readonly commitAct: (
    ctx: ActCtx,
    actType: string,
    input: unknown,
    digest: string,
  ) => Promise<{ actId: string }>;
  readonly listParticipantHistory: (
    ctx: ActCtx,
    projectId: string,
  ) => Promise<readonly Record<string, unknown>[]>;
  readonly ACT_TYPE: Record<string, string>;
  readonly ROLE: Record<string, string>;
}

let seamOnce: Promise<ActsSeam> | undefined;

function actSeam(): Promise<ActsSeam> {
  seamOnce ??= importProduct(ACTS_SEAM).then((module) => module as unknown as ActsSeam);
  return seamOnce;
}

let fixtureOnce: Promise<Fixture> | undefined;

/**
 * A tenant, a pinned project, and three people — memoised into a promise each test awaits
 * rather than built in `beforeAll`, because a throwing `beforeAll` reports its tests as skipped
 * and a skipped claim says nothing.
 */
function fixture(): Promise<Fixture> {
  fixtureOnce ??= (async () => {
    const dbModule = await importProduct(DB_SEAM);
    if (typeof dbModule['closeDb'] === 'function') {
      closeSeam = dbModule['closeDb'] as () => Promise<void>;
    }
    const { forTenant } = dbModule as unknown as Seam;
    const system = await systemClient();

    const tenantRows = await query(
      system,
      'insert into public.tenants (slug, name) values ($1, $2) returning id',
      [`acts-lane-${RUN}`, `acts lane ${RUN}`],
    );
    const tenantId = String(tenantRows[0]?.['id'] ?? '');

    const mint = async (label: string): Promise<string> => {
      const rows = await query(
        system,
        'insert into public.users (email, name, email_verified) values ($1, $2, true) returning id',
        [`acts-lane-${RUN}-${label}@example.test`, label],
      );
      return String(rows[0]?.['id'] ?? '');
    };
    const principalId = await mint('principal');
    const memberId = await mint('member');
    const outsiderId = await mint('outsider');

    const seedModule = await importProduct(RULESET_SEED);
    const createPinnedProject = seedModule['createPinnedProject'] as (
      handle: unknown,
      input: { tenantId: string; name: string; code: string },
    ) => Promise<{ projectId: string }>;
    const created = await createPinnedProject(forTenant({ tenantId }), {
      tenantId,
      name: `acts lane ${RUN}`,
      code: `ACTS-${RUN}`,
    });

    const ctx: ActCtx = {
      db: forTenant({ tenantId }),
      tenantId,
      actorId: principalId,
    };
    const { foundPrincipal } = await actSeam();
    await foundPrincipal(ctx, created.projectId);

    return { tenantId, projectId: created.projectId, principalId, memberId, outsiderId, ctx };
  })();
  return fixtureOnce;
}

const assignment = (projectId: string, userId: string, role: string): Record<string, unknown> => ({
  projectId,
  userId,
  role,
});

async function refusalCode(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
    return '';
  } catch (error: unknown) {
    return String((error as { code?: unknown }).code ?? '');
  }
}

/* ──────────────────────────── what the database itself enforces ─────────────────────── */

describe('the act log, as Postgres holds it (L-ACT-01, L-ACT-03, V-DB)', () => {
  it('foundPrincipal writes the participation, the grant and the act together', async () => {
    const found = await fixture();
    const system = await systemClient();

    const rows = await query(
      system,
      `select r.role, r.act_id, a.actor_id, a.project_id, p.user_id as participant
         from public.participant_roles r
         join public.acts a on a.id = r.act_id
         join public.participants p
           on p.project_id = r.project_id and p.user_id = r.user_id
        where r.project_id = $1 and r.user_id = $2`,
      [found.projectId, found.principalId],
    );
    expect(rows.length, 'foundPrincipal did not leave one row in each of the three tables').toBe(1);
    const { ROLE } = await actSeam();
    expect(rows[0]?.['role']).toBe(ROLE['PRINCIPAL']);
    expect(String(rows[0]?.['actor_id'])).toBe(found.principalId);
    expect(String(rows[0]?.['project_id'])).toBe(found.projectId);
  });

  it('L-ACT-03: an act on a project by somebody who takes no part in it is refused by the FK', async () => {
    // "Participation is a composite FK from the act log" — a database fact, so an act type that
    // never learned to check still cannot write one.
    const found = await fixture();
    const system = await systemClient();
    const code = await refusalCode(() =>
      query(
        system,
        `insert into public.acts (tenant_id, actor_id, act_type, project_id)
           values ($1, $2, $3, $4)`,
        [found.tenantId, found.outsiderId, 'probe', found.projectId],
      ),
    );
    expect(
      code,
      'an act naming a project its actor does not take part in was accepted — L-ACT-03’s ' +
        'composite foreign key is not doing the work the law gives it',
    ).toBe(FOREIGN_KEY_VIOLATION);
  });

  it('an act carrying no project at all is still legal (MATCH SIMPLE), so the log stays open', async () => {
    // The composite key is MATCH SIMPLE on purpose: `acts` predates participation, and the rows
    // inc-010 writes carry no project. A stricter key would have rewritten history.
    const found = await fixture();
    const system = await systemClient();
    const code = await refusalCode(() =>
      query(
        system,
        `insert into public.acts (tenant_id, actor_id, act_type, project_id)
           values ($1, $2, $3, null)`,
        [found.tenantId, found.outsiderId, 'probe'],
      ),
    );
    expect(code, 'a project-less act was refused').toBe('');
  });

  it('a second grant to the same person is a second role, not a second participation', async () => {
    const found = await fixture();
    const system = await systemClient();
    const { previewAct, commitAct, ACT_TYPE, ROLE } = await actSeam();
    const actType = String(ACT_TYPE['ASSIGN_PARTICIPANT_ROLE']);

    const promote = assignment(found.projectId, found.memberId, String(ROLE['MEASURER']));
    const first = await previewAct(found.ctx, actType, promote);
    await commitAct(found.ctx, actType, promote, first.digest);

    const again = assignment(found.projectId, found.memberId, String(ROLE['REVIEWER']));
    const second = await previewAct(found.ctx, actType, again);
    await commitAct(found.ctx, actType, again, second.digest);

    const participations = await query(
      system,
      'select count(*)::int as n from public.participants where project_id = $1 and user_id = $2',
      [found.projectId, found.memberId],
    );
    expect(participations[0]?.['n'], 'the second grant wrote a second participation').toBe(1);

    const grants = await query(
      system,
      `select role from public.participant_roles
        where project_id = $1 and user_id = $2 order by created_at asc, id asc`,
      [found.projectId, found.memberId],
    );
    // L-ACT-01, append-only: the first grant is still there to be read.
    expect(grants.map((row) => row['role'])).toEqual([ROLE['MEASURER'], ROLE['REVIEWER']]);
  });

  it('the participation’s unique key refuses a duplicate outright', async () => {
    const found = await fixture();
    const system = await systemClient();
    const code = await refusalCode(() =>
      query(
        system,
        'insert into public.participants (tenant_id, project_id, user_id) values ($1, $2, $3)',
        [found.tenantId, found.projectId, found.principalId],
      ),
    );
    expect(code, 'a project can hold the same person twice').toBe(UNIQUE_VIOLATION);
  });

  it('L-ACT-01 / B-05: cubit_app cannot rewrite or erase what happened', async () => {
    // The grant is what makes the log append-only. Read here as the refusal it produces, so a
    // grant that was quietly widened turns this red rather than passing on a catalogue row.
    const found = await fixture();
    const system = await systemClient();
    for (const table of ['acts', 'participants', 'participant_roles']) {
      const updated = await refusalCode(() =>
        query(system, `update public.${table} set tenant_id = tenant_id where tenant_id = $1`, [
          found.tenantId,
        ]),
      );
      expect(updated, `cubit_app can UPDATE public.${table}`).toBe(INSUFFICIENT_PRIVILEGE);
      const deleted = await refusalCode(() =>
        query(system, `delete from public.${table} where tenant_id = $1`, [found.tenantId]),
      );
      expect(deleted, `cubit_app can DELETE from public.${table}`).toBe(INSUFFICIENT_PRIVILEGE);
    }
  });

  it('R-SPINE-011: the history the seam reads is the history the database holds, oldest first', async () => {
    const found = await fixture();
    const system = await systemClient();
    const { listParticipantHistory } = await actSeam();
    const history = await listParticipantHistory(found.ctx, found.projectId);
    const rows = await query(
      system,
      `select user_id, role, act_id from public.participant_roles
        where project_id = $1 order by created_at asc, id asc`,
      [found.projectId],
    );
    expect(history.length, 'the seam read a different number of grants than the table holds').toBe(
      rows.length,
    );
    expect(history.map((grant) => [grant['userId'], grant['role'], grant['actId']])).toEqual(
      rows.map((row) => [String(row['user_id']), String(row['role']), String(row['act_id'])]),
    );
  });
});

/* ─────────────────────────── the seam is the log's sole writer ──────────────────────── */

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

describe('L-ACT-01 — the seam is unimportable elsewhere', () => {
  it('nothing under src/ outside src/core/acts names the three tables at all', async () => {
    const names = /\b(acts|participants|participant_roles|participantRoles)\b/;
    const offences: string[] = [];
    for (const relative of walk('src')) {
      if (relative.startsWith(`${ACTS_SEAM}/`)) continue;
      if (relative.split('/').includes('__tests__')) continue;
      const text = readFileSync(at(relative), 'utf8');
      for (const line of text.split('\n')) {
        // Only a line that reaches a *table* is an offence: the tRPC namespace is called `acts`
        // too, and a router that mounts it is not a writer of the log.
        if (!/fullSchema|db\/schema|insert\s+into|update\s+|delete\s+from/i.test(line)) continue;
        if (names.test(line)) offences.push(`${relative}: ${line.trim()}`);
      }
    }
    expect(
      offences,
      'L-ACT-01: the act seam "is the sole writer of the log and unimportable elsewhere"',
    ).toEqual([]);
  });

  it('the seam’s barrel is the only door into it', async () => {
    // Every module under src/ that uses the seam reaches it through src/core/acts, never through
    // one of the files behind it — which is what makes "the barrel is the only import surface"
    // (the Increment Spec's own words) checkable rather than aspirational.
    const inside = /from\s+['"][^'"]*core\/acts\/(?!index)[a-z-]+['"]/;
    const offences: string[] = [];
    for (const relative of walk('src')) {
      if (relative.startsWith(`${ACTS_SEAM}/`)) continue;
      const text = readFileSync(at(relative), 'utf8');
      if (inside.test(text)) offences.push(relative);
    }
    expect(offences, 'these modules import past the act seam’s barrel').toEqual([]);
  });
});
