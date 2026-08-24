/**
 * The act seam's two new tenant-carrying tables (db/schema/spine/acts.ts): `participants` and
 * `participant_roles`, founded by inc-013.
 *
 * Both carry `tenant_id`, so the enumeration discovers them and refuses to pass over either one
 * until a probe can exercise it (Q-02, and index.ts's own note: a module-founding increment
 * drops its file in beside the registry).
 *
 * Participation is the deepest parent chain in the tree so far — a row needs a project, a
 * project needs the rule-set edition it is pinned to (L-REG-07: an unpinned project is
 * unrepresentable), and a grant needs the act that made it. The seed below builds that chain
 * per tenant under system scope, so every probed write is otherwise lawful and the refusal the
 * enumeration reads can only have come from row-level security. A row that also broke a foreign
 * key would prove nothing about the policy.
 *
 * The act it writes carries `project_id`, which is what puts L-ACT-03's composite foreign key
 * `(project_id, actor_id) → participants(project_id, user_id)` under the probe as well: the
 * participation is written first, and the act names the person who takes part.
 */
import { randomUUID } from 'node:crypto';
import { editionDigest } from '../../../src/core/rulesets/editions';
import { IS1200_SEED } from '../../../src/core/rulesets/seed';
import { exec, rowsOf, sql } from '../support/seam';
import type { ScopedHandle } from '../support/seam';
import type { TableProbe } from './index';

/** What one tenant's chain came to, so the cross-tenant write can name real parents. */
interface Seeded {
  readonly projectId: string;
  readonly userId: string;
  readonly actId: string;
}

const seededOf = new Map<string, Seeded>();

/**
 * The lineage a project has to be pinned to, in the product's own identity.
 *
 * `participants` sorts before `projects`, so this file's seed runs first — and a project cannot
 * exist unpinned (L-REG-07), so seeding one means reaching for the platform seed. That namespace
 * is the one L-MEA-01 keeps to a single row, and a probe that minted a seed of its own devising
 * would put a second one in it for every suite that reads it afterwards.
 *
 * So the seed below is `IS1200_IN @ 2026.08` itself — the product's constant, digested by the
 * product's own function, written `on conflict do nothing` so that whoever gets there first
 * wins and everybody else reads that row. `src/core/rulesets/seed.ts` looks the seed up by name
 * and version, so a template forked later finds this row rather than minting a rival.
 *
 * Written as SQL rather than through `createPinnedProject` for one reason: that function opens
 * a transaction, and a probe that holds a pooled connection while the rest of the lane waits
 * changes the order other suites see the world in. For the same reason the whole chain below is
 * *one* statement: a probe's round trips are round trips every suite beside it waits for, and
 * `db/__tests__/inc-012-rulesets-immutability.test.ts` reads the platform namespace expecting to
 * find one row in it — so the less of the lane's time this file takes, the less it moves.
 */
const SEED_DIGEST = editionDigest(IS1200_SEED.parameters, IS1200_SEED.methods);
const SEED_PARAMETERS = JSON.stringify(IS1200_SEED.parameters);
const SEED_METHODS = JSON.stringify(IS1200_SEED.methods);

/** The whole chain for one tenant: a project, a person taking part in it, and one act. */
async function seedChain(system: ScopedHandle, tenantId: string): Promise<Seeded> {
  const found = seededOf.get(tenantId);
  if (found !== undefined) return found;

  // One statement — the seed, this tenant's fork of it, a project pinned to that, a person,
  // their participation, the act and the grant it made. A data-modifying CTE for the reason the
  // seam itself is one: foreign keys are checked at the end of the statement, so a parent and
  // its child may arrive together.
  //
  // Each edition is minted `on conflict do nothing` and then read: the insert's `returning` is
  // empty exactly when the row was already there, and the read arm sees the statement's own
  // snapshot, which is exactly when the row was already there. One arm answers, never both.
  const rows = await rowsOf(
    system,
    sql`with minted_seed as (
          insert into rule_set_editions
                (scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods)
               values (${'platform'}, ${null}, ${null}, ${IS1200_SEED.name}, ${IS1200_SEED.version},
                       ${SEED_DIGEST}, ${SEED_PARAMETERS}::jsonb, ${SEED_METHODS}::jsonb)
          on conflict do nothing
            returning id
        ),
        seed as (
          select id from minted_seed
          union all
          select id from rule_set_editions
           where scope = ${'platform'} and tenant_id is null
             and name = ${IS1200_SEED.name} and version = ${IS1200_SEED.version}
          limit 1
        ),
        minted_template as (
          insert into rule_set_editions
                (scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods)
               select ${'tenant'}, ${tenantId}, seed.id, ${IS1200_SEED.name}, ${IS1200_SEED.version},
                      ${SEED_DIGEST}, ${SEED_PARAMETERS}::jsonb, ${SEED_METHODS}::jsonb
                 from seed
          on conflict do nothing
            returning id
        ),
        template as (
          select id from minted_template
          union all
          select id from rule_set_editions
           where scope = ${'tenant'} and tenant_id = ${tenantId}
             and name = ${IS1200_SEED.name} and version = ${IS1200_SEED.version}
          limit 1
        ),
        made_project as (
          insert into projects (tenant_id, name, code, rule_set_edition_id)
               select ${tenantId}, ${'probe'}, ${`PB-${randomUUID().slice(0, 8)}`}, template.id
                 from template
            returning id
        ),
        made_user as (
          insert into users (email, name)
               values (${`probe-acts-${randomUUID()}@example.test`}, ${'probe'})
            returning id
        ),
        joined as (
          insert into participants (tenant_id, project_id, user_id)
               select ${tenantId}, made_project.id, made_user.id from made_project, made_user
            returning project_id, user_id
        ),
        performed as (
          insert into acts (tenant_id, actor_id, act_type, project_id)
               select ${tenantId}, joined.user_id, ${'probe'}, joined.project_id from joined
            returning id, actor_id, project_id
        )
        insert into participant_roles (tenant_id, project_id, user_id, role, act_id)
             select ${tenantId}, performed.project_id, performed.actor_id, ${'probe'}, performed.id
               from performed
          returning project_id, user_id, act_id`,
  );
  const made = rows[0] ?? {};
  const projectId = String(made['project_id'] ?? '');
  const userId = String(made['user_id'] ?? '');
  const actId = String(made['act_id'] ?? '');
  if (projectId === '' || userId === '' || actId === '') {
    throw new Error(`the probe's chain wrote nothing: ${JSON.stringify(rows)}`);
  }

  const seeded: Seeded = { projectId, userId, actId };
  seededOf.set(tenantId, seeded);
  return seeded;
}

/** Who takes part in a project. The policy keeps it one tenant's. */
const participants: TableProbe = {
  scopeColumn: 'tenant_id',
  seed: async (system, tenantId) => {
    await seedChain(system, tenantId);
  },
  // Another tenant's project and another tenant's person: every foreign key is satisfied and
  // the unique key is free, so the policy is the only thing that can refuse this row.
  crossTenantInsert: (scoped, otherTenantId) => {
    const other = seededOf.get(otherTenantId);
    return exec(
      scoped,
      sql`insert into participants (tenant_id, project_id, user_id)
          values (${otherTenantId}, ${other?.projectId ?? randomUUID()},
                  ${other?.userId ?? randomUUID()})`,
    );
  },
};

/**
 * The append-only history of what each participant was given. The grant keeps it append-only;
 * the policy keeps it one tenant's — a grant written into somebody else's project is a record
 * of an authority nobody conferred.
 */
const participantRoles: TableProbe = {
  scopeColumn: 'tenant_id',
  seed: async (system, tenantId) => {
    await seedChain(system, tenantId);
  },
  crossTenantInsert: (scoped, otherTenantId) => {
    const other = seededOf.get(otherTenantId);
    return exec(
      scoped,
      sql`insert into participant_roles (tenant_id, project_id, user_id, role, act_id)
          values (${otherTenantId}, ${other?.projectId ?? randomUUID()},
                  ${other?.userId ?? randomUUID()}, ${'probe'}, ${other?.actId ?? randomUUID()})`,
    );
  },
};

export default { participants, participant_roles: participantRoles };
