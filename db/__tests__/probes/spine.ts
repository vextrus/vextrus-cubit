/**
 * The `spine` module's tenant-carrying tables (db/schema/spine): `tenant_memberships`,
 * `invitations` and `acts`.
 *
 * The other five spine tables carry no `tenant_id` — a user belongs to many tenants
 * (R-SPINE-002), so the identity itself is not tenant-scoped — and the enumeration
 * discovers tables by that column, so this file registers the three it finds.
 *
 * A membership needs a member, so the seed writes a `users` row first (under system scope,
 * which is the only scope `users` has a policy arm for) and joins it to the tenant.
 */
import { randomUUID } from 'node:crypto';
import { exec, rowsOf, sql } from '../support/seam';
import type { ScopedHandle } from '../support/seam';
import type { TableProbe } from './index';

/** A user of this probe's own, so the seeded membership has somebody to be about. */
async function seedUser(system: ScopedHandle): Promise<string> {
  const rows = await rowsOf(
    system,
    sql`insert into users (email, name) values (${`probe-${randomUUID()}@example.test`}, ${'probe'}) returning id`,
  );
  const id = rows[0]?.['id'];
  if (typeof id !== 'string') {
    throw new Error(`runAsSystem could not insert a user: ${JSON.stringify(rows)}`);
  }
  return id;
}

/**
 * The first seeded member, kept so the cross-tenant write is refused by the policy and by
 * nothing else: a made-up user id would fail the foreign key too, and a refusal that could
 * have come from either place proves neither.
 */
let seededUserId: string | undefined;

const tenantMemberships: TableProbe = {
  scopeColumn: 'tenant_id',
  seed: async (system, tenantId) => {
    const userId = await seedUser(system);
    seededUserId ??= userId;
    await exec(
      system,
      sql`insert into tenant_memberships (tenant_id, user_id) values (${tenantId}, ${userId})`,
    );
  },
  // The row belongs to somebody else: a tenant-scoped handle must not be able to write a
  // membership into another tenant. The member is real and the pair is new, so row-level
  // security is the only thing left that can refuse it.
  crossTenantInsert: (scoped, otherTenantId) =>
    exec(
      scoped,
      sql`insert into tenant_memberships (tenant_id, user_id) values (${otherTenantId}, ${seededUserId ?? randomUUID()})`,
    ),
};

/**
 * An invitation belongs to a tenant and names the member who sent it (R-SPINE-003). The
 * invited address is a string rather than a user: the invited person may have no account yet.
 */
const invitations: TableProbe = {
  scopeColumn: 'tenant_id',
  seed: async (system, tenantId) => {
    const userId = await seedUser(system);
    seededUserId ??= userId;
    await exec(
      system,
      sql`insert into invitations (tenant_id, email, role, invited_by)
          values (${tenantId}, ${`probe-${randomUUID()}@example.test`}, ${'member'}, ${userId})`,
    );
  },
  crossTenantInsert: (scoped, otherTenantId) =>
    exec(
      scoped,
      sql`insert into invitations (tenant_id, email, role, invited_by)
          values (${otherTenantId}, ${`probe-${randomUUID()}@example.test`}, ${'member'}, ${
            seededUserId ?? randomUUID()
          })`,
    ),
};

/**
 * The append-only ledger. The grant keeps it append-only; the policy keeps it one tenant's —
 * both arms, because an act written into somebody else's ledger is a record of a thing that
 * did not happen there.
 */
const acts: TableProbe = {
  scopeColumn: 'tenant_id',
  seed: async (system, tenantId) => {
    const userId = await seedUser(system);
    seededUserId ??= userId;
    await exec(
      system,
      sql`insert into acts (tenant_id, actor_id, act_type, campaign_ref)
          values (${tenantId}, ${userId}, ${'probe'}, ${null})`,
    );
  },
  crossTenantInsert: (scoped, otherTenantId) =>
    exec(
      scoped,
      sql`insert into acts (tenant_id, actor_id, act_type, campaign_ref)
          values (${otherTenantId}, ${seededUserId ?? randomUUID()}, ${'probe'}, ${null})`,
    ),
};

export default { tenant_memberships: tenantMemberships, invitations, acts };
