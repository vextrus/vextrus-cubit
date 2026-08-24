/**
 * inc-012 — two projects created at the same moment share one tenant template (L-REG-07).
 *
 *     pnpm test:db db/__tests__/inc-012-rulesets-fork-race.test.ts
 *
 * `createPinnedProject` reads the tenant's template, and forks one when it finds none. Two
 * calls for one tenant can both find none, and then the partial unique index
 * `rule_set_editions_tenant_template_uniq` refuses the second fork — which is the whole reason
 * `mintTenantTemplate` carries a recovery path that re-reads the template the racing
 * transaction committed.
 *
 * A recovery path that has never been executed is a comment. Postgres aborts the entire
 * transaction on a constraint violation and refuses every statement after it until a rollback
 * (25P02), so a recovery that re-reads on the same transaction handle can only work if the
 * failed INSERT was rolled back to a SAVEPOINT first. That is not visible in the seam's types
 * and no assertion above this level can see it: it shows up only as a project creation that
 * fails under concurrency, which is exactly what this file drives.
 *
 * The claim is about the outcome a caller can observe — both calls return a pinned project,
 * the tenant holds one template, and both project editions were forked from it — not about
 * which of the two took the recovery path.
 */
import { existsSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO } from './support/lanes';
import { createTenant, loadSeam, ready, rowsOf, sql } from './support/seam';
import type { ScopedHandle, Seam } from './support/seam';

const SEED_MODULE = 'src/core/rulesets/seed';
const SEED_NAME = 'IS1200_IN';
const PLATFORM = 'platform';
const TENANT = 'tenant';

interface Pinned {
  readonly projectId: string;
  readonly editionId: string;
  readonly digest: string;
}

type CreatePinnedProject = (
  handle: unknown,
  input: { tenantId: string; name: string; code: string },
) => Promise<Pinned>;

/** A product module by an absolute path assembled at run time (this lane's recorded idiom). */
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

async function seam(): Promise<Seam> {
  seamOnce ??= loadSeam();
  return seamOnce;
}

async function systemHandle(): Promise<ScopedHandle> {
  return ready((await seam()).runAsSystem('inc-012 fork race: founding its own tenants'));
}

async function createPinnedProject(): Promise<CreatePinnedProject> {
  const module = await importProduct(SEED_MODULE);
  const exported = module['createPinnedProject'];
  expect(typeof exported, `${SEED_MODULE} exports no createPinnedProject`).toBe('function');
  return exported as CreatePinnedProject;
}

afterAll(async () => {
  if (seamOnce !== undefined) {
    try {
      await (await seamOnce).closeDb();
    } catch {
      /* a pool that never opened has nothing to close */
    }
  }
});

describe('L-REG-07 — concurrent creation for one tenant forks one template, not two', () => {
  it('both calls return a pinned project, and neither is refused', async () => {
    const run = randomUUID().slice(0, 8);
    const system = await systemHandle();
    const tenantId = await createTenant(system, `inc012race-${run}`);
    const create = await createPinnedProject();

    // Two handles, so the two transactions are on two connections and genuinely overlap; one
    // handle would serialise them through a single pooled client and prove nothing.
    const one = ready((await seam()).forTenant({ tenantId }));
    const two = ready((await seam()).forTenant({ tenantId }));

    const settled = await Promise.allSettled([
      create(await one, { tenantId, name: `Race A ${run}`, code: `RA-${run}` }),
      create(await two, { tenantId, name: `Race B ${run}`, code: `RB-${run}` }),
    ]);

    const refusals = settled
      .filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected')
      .map((outcome) => String((outcome.reason as { message?: unknown }).message ?? outcome.reason));
    expect(
      refusals,
      `a concurrent createPinnedProject was refused — ${refusals.join(' | ')}`,
    ).toEqual([]);

    const pinned = settled
      .filter((outcome): outcome is PromiseFulfilledResult<Pinned> => outcome.status === 'fulfilled')
      .map((outcome) => outcome.value);
    expect(pinned.length, 'the two calls did not both return').toBe(2);
    expect(pinned[0]?.projectId, 'both calls returned one project').not.toBe(pinned[1]?.projectId);
    expect(pinned[0]?.editionId, 'both projects share one project edition').not.toBe(
      pinned[1]?.editionId,
    );

    // One seed, one template — and both project editions hang off that one template.
    const seeds = await rowsOf(
      system,
      sql`select id from rule_set_editions where scope = ${PLATFORM} and name = ${SEED_NAME}`,
    );
    expect(seeds.length, `${SEED_NAME} was minted ${String(seeds.length)} times`).toBe(1);

    const templates = await rowsOf(
      system,
      sql`select id from rule_set_editions where scope = ${TENANT} and tenant_id = ${tenantId}`,
    );
    expect(
      templates.length,
      `the tenant holds ${String(templates.length)} templates after two concurrent creations`,
    ).toBe(1);

    for (const project of pinned) {
      const rows = await rowsOf(
        system,
        sql`select parent_edition_id from rule_set_editions where id = ${project.editionId}`,
      );
      expect(
        String(rows[0]?.['parent_edition_id']),
        'a project edition was forked from something other than the tenant’s one template',
      ).toBe(String(templates[0]?.['id']));
    }
  });
});
