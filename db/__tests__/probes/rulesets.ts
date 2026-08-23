/**
 * The rule-set module's tenant-carrying tables (db/schema/spine): `rule_set_editions` and
 * `projects`, founded by inc-012.
 *
 * Both carry `tenant_id`, so the enumeration discovers them and refuses to pass over either
 * one until a probe can exercise it — which is what this file is for (Q-02, and index.ts's
 * own note: a module-founding increment drops its file in beside the registry).
 *
 * `rule_set_editions` is the one table whose policy has a third arm: the platform seed belongs
 * to no tenant (`tenant_id` IS NULL) and every tenant scope may read and mint it, because the
 * whole fork happens in one transaction on one scoped handle (L-REG-07). That arm is about
 * rows belonging to *nobody*; a row belonging to *somebody else* is still refused, and that is
 * exactly what `crossTenantInsert` writes below.
 *
 * Every probed write is otherwise lawful — a real parent, a real tenant, a well-formed digest,
 * a scope the check constraint allows — so the refusal the suite reads can only have come from
 * row-level security. A row that also broke a CHECK would prove nothing about the policy.
 */
import { createHash, randomUUID } from 'node:crypto';
import { exec, rowsOf, sql } from '../support/seam';
import type { ScopedHandle } from '../support/seam';
import type { TableProbe } from './index';

/** A digest is 64 lowercase hex by check constraint; any well-formed one will do here. */
const digestOf = (of: string): string => createHash('sha256').update(of).digest('hex');

/** The seed every probed fork descends from: one platform row, minted once. */
let platformId: string | undefined;

/** The tenant-scope edition seeded for each tenant, so a project has something to pin. */
const templateOf = new Map<string, string>();

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

/** The platform seed of this probe's own rule set, minted the first time a tenant needs it. */
async function seedPlatform(system: ScopedHandle): Promise<string> {
  if (platformId !== undefined) return platformId;
  const name = `PROBE_${randomUUID().slice(0, 8)}`;
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

/** One tenant's template, forked from that seed — the parent every probed project edition names. */
async function seedTemplate(system: ScopedHandle, tenantId: string): Promise<string> {
  const found = templateOf.get(tenantId);
  if (found !== undefined) return found;
  const parent = await seedPlatform(system);
  const name = `PROBE_${randomUUID().slice(0, 8)}`;
  const id = await insertedId(
    system,
    sql`insert into rule_set_editions
          (scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods)
        values (${'tenant'}, ${tenantId}, ${parent}, ${name}, ${'2026.08'}, ${digestOf(name)},
                ${'{}'}::jsonb, ${'[]'}::jsonb)
        returning id`,
  );
  templateOf.set(tenantId, id);
  return id;
}

const ruleSetEditions: TableProbe = {
  scopeColumn: 'tenant_id',
  seed: async (system, tenantId) => {
    await seedTemplate(system, tenantId);
  },
  // A project-scope edition of another tenant, forked from that tenant's own template: every
  // constraint on the row is satisfied, so the policy is the only thing that can refuse it.
  crossTenantInsert: async (scoped, otherTenantId) => {
    const parent = templateOf.get(otherTenantId) ?? platformId ?? randomUUID();
    const name = `PROBE_${randomUUID().slice(0, 8)}`;
    return exec(
      scoped,
      sql`insert into rule_set_editions
            (scope, tenant_id, parent_edition_id, name, version, digest, parameters, methods)
          values (${'project'}, ${otherTenantId}, ${parent}, ${name}, ${'2026.08'}, ${digestOf(name)},
                  ${'{}'}::jsonb, ${'[]'}::jsonb)`,
    );
  },
};

const projects: TableProbe = {
  scopeColumn: 'tenant_id',
  seed: async (system, tenantId) => {
    const edition = await seedTemplate(system, tenantId);
    await exec(
      system,
      sql`insert into projects (tenant_id, name, code, rule_set_edition_id)
          values (${tenantId}, ${'probe'}, ${`PB-${randomUUID().slice(0, 8)}`}, ${edition})`,
    );
  },
  // Pinned to the other tenant's own edition, so the pin is real and the refusal is the policy's
  // (L-REG-07: an unpinned project is unrepresentable, so a probe cannot leave the pin out).
  crossTenantInsert: (scoped, otherTenantId) =>
    exec(
      scoped,
      sql`insert into projects (tenant_id, name, code, rule_set_edition_id)
          values (${otherTenantId}, ${'probe'}, ${`PB-${randomUUID().slice(0, 8)}`},
                  ${templateOf.get(otherTenantId) ?? platformId ?? randomUUID()})`,
    ),
};

export default { rule_set_editions: ruleSetEditions, projects };
