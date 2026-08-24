/**
 * inc-012 — the immutability trigger, executed (L-MEA-01, R-SPINE-062, SEAM-TENANT).
 *
 * L-MEA-01: "authoring mints a new edition, never updates one". `rulesets-refusals.test.ts`
 * grades that the migration *says* so — the RAISE EXCEPTION, the two BEFORE triggers, the
 * FOR EACH STATEMENT — by reading the file. Reading a file is not evidence that a database
 * refuses anything: a migration that never applied, a trigger function that failed to compile,
 * or a later migration dropping the trigger all leave that test green.
 *
 * So this file makes the same claim the other way round, against the cold database
 * `pnpm test:db` provisions:
 *
 *     pnpm test:db db/__tests__/inc-012-rulesets-immutability.test.ts
 *
 * Two roles, because the clause has two halves. Through the seam the app role holds no UPDATE
 * and no DELETE grant, so it is refused before a trigger is reached at all. The trigger exists
 * for the *owner* — `cubit_migrate`, whom no grant binds — and it is per statement rather than
 * per row precisely because FORCEd row-level security can make an owner's UPDATE match nothing:
 * the settled reading rejects a FOR EACH ROW trigger that would let "nothing happened" read as
 * "the edition is immutable". That property is checked here by issuing an UPDATE that matches
 * no row at all and requiring the refusal anyway.
 */
import { existsSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Client } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO } from './support/lanes';
import {
  MIGRATE_ROLE,
  attempt,
  connectAs,
  describeError,
  endAll,
  outcomeText,
  query,
  sqlstates,
} from './support/live';
import { createTenant, loadSeam, ready, rowsOf, sql } from './support/seam';
import type { ScopedHandle, Seam } from './support/seam';

/** The refusal this table raises, read off the closed taxonomy rather than retyped. */
const CODE = 'EDITION_IMMUTABLE';

/** The seam the fixture is forked through, and the barrel the code is read from. */
const SEED_MODULE = 'src/core/rulesets/seed';
const ERRORS_MODULE = 'src/core/errors';

/** insufficient_privilege — the app role's answer, since it holds neither grant. */
const INSUFFICIENT_PRIVILEGE = '42501';

/**
 * A product module by an absolute path assembled at run time: a literal specifier is resolved
 * while this file is transformed, so a missing module would make vitest report "0 test" rather
 * than one named failure (the idiom this lane's other files record).
 */
async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const path = join(REPO, ...relative.split('/'));
  const candidates = [`${path}.ts`, `${path}.tsx`, join(path, 'index.ts'), path];
  const found = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  if (found === undefined) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(found).href)) as Record<string, unknown>;
}

let seamOnce: Promise<Seam> | undefined;
const opened: Client[] = [];

async function seam(): Promise<Seam> {
  seamOnce ??= loadSeam();
  return seamOnce;
}

async function systemHandle(): Promise<ScopedHandle> {
  return ready((await seam()).runAsSystem('inc-012 immutability: founding its own tenant'));
}

/**
 * The owner's connection: `cubit_migrate`, scoped to system.
 *
 * FORCEd row-level security binds the owner too, so a raw connection with no `cubit.scope`
 * is refused by the policy (42501) before any trigger fires — which would make every refusal
 * below indistinguishable from RLS. Scoping it to system is what puts the trigger, and only
 * the trigger, between this connection and the row.
 */
async function ownerClient(): Promise<Client> {
  const client = await connectAs(MIGRATE_ROLE);
  opened.push(client);
  await query(client, `select set_config('cubit.scope', 'system', false)`);
  return client;
}

interface Fixture {
  readonly tenantId: string;
  readonly projectId: string;
  readonly editionId: string;
}

let fixtureOnce: Promise<Fixture> | undefined;

/**
 * One tenant with one pinned project, forked through the seam.
 *
 * Memoised into a promise each test awaits rather than built in `beforeAll`: a throwing
 * `beforeAll` reports its tests as skipped, and a skipped claim about a refusal says nothing.
 */
function fixture(): Promise<Fixture> {
  fixtureOnce ??= (async () => {
    const run = randomUUID().slice(0, 8);
    const system = await systemHandle();
    const tenantId = await createTenant(system, `inc012imm-${run}`);
    const module = await importProduct(SEED_MODULE);
    const create = module['createPinnedProject'];
    expect(typeof create, `${SEED_MODULE} exports no createPinnedProject`).toBe('function');
    const handle = ready((await seam()).forTenant({ tenantId }));
    const pinned = (await (
      create as (h: unknown, i: { tenantId: string; name: string; code: string }) => Promise<{
        projectId: string;
        editionId: string;
      }>
    )(await handle, { tenantId, name: `Immutable ${run}`, code: `IM-${run}` }));
    return { tenantId, projectId: pinned.projectId, editionId: pinned.editionId };
  })();
  return fixtureOnce;
}

/** The registered code, so SQL and the taxonomy are checked to be the same one word. */
async function registeredCode(): Promise<string> {
  const barrel = await importProduct(ERRORS_MODULE);
  const codes = barrel['REFUSAL_CODES'] as readonly string[] | undefined;
  expect(
    codes === undefined ? [] : [...codes],
    `${ERRORS_MODULE} carries no ${CODE} — the code the database raises and the code the register holds would be two refusals`,
  ).toContain(CODE);
  return CODE;
}

afterAll(async () => {
  await endAll(opened);
  if (seamOnce !== undefined) {
    try {
      await (await seamOnce).closeDb();
    } catch {
      /* a pool that never opened has nothing to close */
    }
  }
});

describe('L-MEA-01 — the database refuses to change a rule-set edition', () => {
  it('the control: this owner connection can read the edition and can UPDATE another table', async () => {
    const { editionId, projectId } = await fixture();
    const owner = await ownerClient();

    const rows = await query(owner, 'select id from rule_set_editions where id = $1', [editionId]);
    expect(rows.length, 'the owner connection cannot even read the edition it will be refused')
      .toBe(1);

    // `projects` carries the same FORCEd RLS and no trigger, so an UPDATE that works here is
    // proof that the refusals below are the trigger and not the policy or a dead connection.
    const allowed = await attempt(async () =>
      query(owner, 'update projects set name = name where id = $1', [projectId]),
    );
    expect(
      allowed.ok,
      `the owner could not UPDATE projects, so nothing below is about the trigger: ${outcomeText(allowed)}`,
    ).toBe(true);
  });

  it('an UPDATE of an edition row is refused, by the name the register carries', async () => {
    const code = await registeredCode();
    const { editionId } = await fixture();
    const owner = await ownerClient();

    const refused = await attempt(async () =>
      query(owner, `update rule_set_editions set version = '9999.99' where id = $1`, [editionId]),
    );
    expect(
      refused.ok,
      'an UPDATE of a rule-set edition was accepted — authoring mints a new edition, never updates one',
    ).toBe(false);
    expect(
      refused.ok ? '' : describeError(refused.error),
      `the UPDATE was refused, but not by name: ${outcomeText(refused)}`,
    ).toContain(code);

    const after = await query(owner, 'select version from rule_set_editions where id = $1', [
      editionId,
    ]);
    expect(String(after[0]?.['version']), 'the refused UPDATE changed the row anyway').not.toBe(
      '9999.99',
    );
  });

  it('a DELETE of an edition row is refused by the same name, and the row survives', async () => {
    const code = await registeredCode();
    const { editionId } = await fixture();
    const owner = await ownerClient();

    const refused = await attempt(async () =>
      query(owner, 'delete from rule_set_editions where id = $1', [editionId]),
    );
    expect(refused.ok, 'a rule-set edition was deleted — an edition is written once').toBe(false);
    expect(
      refused.ok ? '' : describeError(refused.error),
      `the DELETE was refused, but not by name: ${outcomeText(refused)}`,
    ).toContain(code);

    const after = await query(owner, 'select id from rule_set_editions where id = $1', [editionId]);
    expect(after.length, 'the refused DELETE removed the row anyway').toBe(1);
  });

  /**
   * The settled reading, executed: the trigger is FOR EACH STATEMENT, "so an UPDATE/DELETE on
   * rule_set_editions is refused by name even when FORCEd RLS made it match no row". A row
   * trigger would fire zero times here and the statement would pass in silence — "nothing
   * happened" reading as "the edition is immutable".
   */
  it('an UPDATE that matches no row at all is refused by name too — the trigger is per statement', async () => {
    const code = await registeredCode();
    await fixture();
    const owner = await ownerClient();

    for (const statement of [
      `update rule_set_editions set version = '9999.99' where id = $1`,
      'delete from rule_set_editions where id = $1',
    ]) {
      const refused = await attempt(async () => query(owner, statement, [randomUUID()]));
      expect(
        refused.ok,
        `"${statement}" matched no row and passed in silence — a per-row trigger never fires, and silence is never lawful`,
      ).toBe(false);
      expect(
        refused.ok ? '' : describeError(refused.error),
        `"${statement}" was refused, but not by name: ${outcomeText(refused)}`,
      ).toContain(code);
    }
  });

  /**
   * The other half of "written once": what a tenant scope may write into the shared namespace.
   *
   * L-REG-07 / SEAM-TENANT settle that a tenant scope must be able to mint the platform seed,
   * because the whole fork happens in one transaction on one scoped handle. A platform row is
   * readable by every workspace and, by the trigger above, can never be deleted — so the arm
   * that allows it is bounded to L-MEA-01's own seed, by name, version and the digest that
   * keys its content. Anything else a tenant scope tries to leave there is refused.
   */
  it('a tenant scope may mint L-MEA-01’s seed and nothing else into the platform namespace', async () => {
    const { tenantId } = await fixture();
    const handle = ready((await seam()).forTenant({ tenantId }));
    const scoped = await handle;

    // The control: the fixture's own fork already minted the seed through this very scope, so
    // the platform arm is open and the refusals below are its bounds, not its absence.
    const seed = await rowsOf(
      scoped,
      sql`select id, name, version, digest from rule_set_editions
           where scope = 'platform' and tenant_id is null`,
    );
    expect(seed.length, 'no platform seed was minted under a tenant scope at all').toBe(1);
    const digest = String(seed[0]?.['digest']);

    const rogue: ReadonlyArray<readonly [string, string, string, string]> = [
      ['another name', 'IS9999_XX', '2026.08', digest],
      ['another version', String(seed[0]?.['name']), '2099.01', digest],
      [
        'other parameter values (a different digest under the same key)',
        String(seed[0]?.['name']),
        String(seed[0]?.['version']),
        digest.startsWith('f') ? `0${digest.slice(1)}` : `f${digest.slice(1)}`,
      ],
    ];

    for (const [what, name, version, hex] of rogue) {
      const refused = await attempt(async () =>
        rowsOf(
          scoped,
          sql`insert into rule_set_editions
                (scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods)
              values ('platform', NULL, NULL, ${name}, ${version}, ${hex}, '{}'::jsonb, '[]'::jsonb)`,
        ),
      );
      expect(
        refused.ok,
        `a tenant scope wrote a platform row with ${what} — every other workspace reads it and no one can delete it`,
      ).toBe(false);
    }
  });

  it('through the seam the app role never reaches the trigger: it holds neither grant', async () => {
    const { editionId } = await fixture();
    const system = await systemHandle();

    // The control: the same handle reads the row, so the refusals are about the verbs.
    const read = await rowsOf(
      system,
      sql`select id from rule_set_editions where id = ${editionId}`,
    );
    expect(read.length, 'the seam cannot read the edition, so the refusals prove nothing').toBe(1);

    for (const statement of [
      sql`update rule_set_editions set version = ${'9999.99'} where id = ${editionId}`,
      sql`delete from rule_set_editions where id = ${editionId}`,
    ]) {
      const refused = await attempt(async () => rowsOf(system, statement));
      expect(
        refused.ok,
        `the app role changed a rule-set edition through the seam — ${outcomeText(refused)}`,
      ).toBe(false);
      expect(
        refused.ok ? [] : sqlstates(refused.error),
        `the seam's refusal is not the grant's: ${outcomeText(refused)}`,
      ).toContain(INSUFFICIENT_PRIVILEGE);
    }
  });
});
