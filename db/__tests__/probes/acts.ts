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
import { createHash, randomUUID } from 'node:crypto';
import { exec, rowsOf, sql } from '../support/seam';
import type { ScopedHandle } from '../support/seam';
import type { TableProbe } from './index';

/** A digest is 64 lowercase hex by check constraint; any well-formed one will do here. */
const digestOf = (of: string): string => createHash('sha256').update(of).digest('hex');

/** What one tenant's chain came to, so the cross-tenant write can name real parents. */
interface Seeded {
  readonly projectId: string;
  readonly userId: string;
  readonly actId: string;
}

const seededOf = new Map<string, Seeded>();

/** The platform seed every probed fork descends from, minted the first time a tenant needs it. */
let platformId: string | undefined;

async function insertedId(
  handle: ScopedHandle,
  statement: Parameters<typeof rowsOf>[1],
): Promise<string> {
  const rows = await rowsOf(handle, statement);
  const id = rows[0]?.['id'];
  if (typeof id !== 'string') {
    throw new Error(`the probe's insert returned no id: ${JSON.stringify(rows)}`);
  }
  return id;
}

async function seedPlatform(system: ScopedHandle): Promise<string> {
  if (platformId !== undefined) return platformId;
  const name = `PROBE_ACTS_${randomUUID().slice(0, 8)}`;
  platformId = await insertedId(
    system,
    sql`insert into rule_set_editions
          (scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods)
        values (${'platform'}, ${null}, ${null}, ${name}, ${'2026.08'}, ${digestOf(name)},
                ${'{}'}::jsonb, ${'[]'}::jsonb)
        returning id`,
  );
  return platformId;
}

/** A project of this probe's own, pinned to a tenant edition forked from that seed. */
async function seedProject(system: ScopedHandle, tenantId: string): Promise<string> {
  const parent = await seedPlatform(system);
  const name = `PROBE_ACTS_${randomUUID().slice(0, 8)}`;
  const edition = await insertedId(
    system,
    sql`insert into rule_set_editions
          (scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods)
        values (${'tenant'}, ${tenantId}, ${parent}, ${name}, ${'2026.08'}, ${digestOf(name)},
                ${'{}'}::jsonb, ${'[]'}::jsonb)
        returning id`,
  );
  return insertedId(
    system,
    sql`insert into projects (tenant_id, name, code, rule_set_edition_id)
        values (${tenantId}, ${'probe'}, ${`PB-${randomUUID().slice(0, 8)}`}, ${edition})
        returning id`,
  );
}

/** The whole chain for one tenant: a project, a person taking part in it, and one act. */
async function seedChain(system: ScopedHandle, tenantId: string): Promise<Seeded> {
  const found = seededOf.get(tenantId);
  if (found !== undefined) return found;

  const projectId = await seedProject(system, tenantId);
  const userId = await insertedId(
    system,
    sql`insert into users (email, name)
        values (${`probe-acts-${randomUUID()}@example.test`}, ${'probe'})
        returning id`,
  );
  await exec(
    system,
    sql`insert into participants (tenant_id, project_id, user_id)
        values (${tenantId}, ${projectId}, ${userId})`,
  );
  const actId = await insertedId(
    system,
    sql`insert into acts (tenant_id, actor_id, act_type, project_id)
        values (${tenantId}, ${userId}, ${'probe'}, ${projectId})
        returning id`,
  );
  await exec(
    system,
    sql`insert into participant_roles (tenant_id, project_id, user_id, role, act_id)
        values (${tenantId}, ${projectId}, ${userId}, ${'probe'}, ${actId})`,
  );

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
