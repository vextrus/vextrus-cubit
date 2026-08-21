/**
 * The founding module's tables (db/schema/core): `tenants` and `seam_smoke`.
 *
 * SEAM-TENANT: "tenants rows are inserted only under system scope"; every other table
 * carries the tenant_id the policy scopes on.
 */
import { randomUUID } from 'node:crypto';
import { exec, sql } from '../support/seam';
import type { TableProbe } from './index';

const tenants: TableProbe = {
  scopeColumn: 'id',
  // The tenant row is the fixture itself: the suite creates its tenants under system
  // scope before it seeds anything else.
  seed: async () => undefined,
  crossTenantInsert: (scoped, otherTenantId) =>
    exec(
      scoped,
      sql`insert into tenants (id, slug, name) values (${otherTenantId}, ${`probe-${randomUUID()}`}, ${'stolen'})`,
    ),
};

const seamSmoke: TableProbe = {
  scopeColumn: 'tenant_id',
  seed: async (system, tenantId) => {
    await exec(
      system,
      sql`insert into seam_smoke (tenant_id, note) values (${tenantId}, ${`probe-${randomUUID()}`})`,
    );
  },
  crossTenantInsert: (scoped, otherTenantId) =>
    exec(scoped, sql`insert into seam_smoke (tenant_id, note) values (${otherTenantId}, ${'stolen'})`),
};

export default { tenants, seam_smoke: seamSmoke };
