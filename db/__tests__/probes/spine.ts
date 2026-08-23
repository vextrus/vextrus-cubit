/**
 * The `spine` module's tenant-carrying table (db/schema/spine): `tenant_memberships`.
 *
 * The other five spine tables carry no `tenant_id` — a user belongs to many tenants
 * (R-SPINE-002), so the identity itself is not tenant-scoped — and the enumeration
 * discovers tables by that column, so this file registers the one table it finds.
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

export default { tenant_memberships: tenantMemberships };
