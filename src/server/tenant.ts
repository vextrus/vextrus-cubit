import { and, desc, eq, forTenant, runAsSystem, tables } from '../core/db';
import { refusal } from '../core/errors';

/**
 * R-SPINE-002 — every user gets a personal tenant at sign-up; a user may belong
 * to many tenants; the active tenant is explicit in the URL (`/t/{slug}`, D-01).
 *
 * Nothing here knows a tenant id before it has looked one up, so slug resolution
 * and tenant creation come through `runAsSystem(reason)` with their reason
 * recorded on the connection. Everything that *does* know a tenant reads through
 * `forTenant(ctx)` and is bounded by the policy, not by a check written here.
 */

export interface TenantSummary {
  tenantId: string;
  slug: string;
  name: string;
  kind: string;
}

export interface Membership {
  tenantId: string;
  slug: string;
  name: string;
  kind: string;
  role: string;
}

/** A tenant's address is derived from its name, and the address is its URL. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Postgres' unique violation — the arbiter when two sign-ups want one address.
 * The driver's error arrives wrapped by drizzle, so the cause chain is read
 * rather than the outermost error.
 */
function isAddressTaken(error: unknown): boolean {
  for (let step: unknown = error; step !== null && step !== undefined; step = (step as { cause?: unknown }).cause) {
    if (typeof step !== 'object') return false;
    if ((step as { code?: unknown }).code === '23505') return true;
  }
  return false;
}

/**
 * R-SPINE-002 / AC-12 — the personal tenant is minted *in the user-create
 * transaction*, which is a place TypeScript cannot stand in: better-auth's
 * insert runs on the auth role's own connection, and a second write from here
 * would be a second transaction with a window between them. The mint is a
 * trigger on `user` instead (db/migrations/0003), deriving the address exactly
 * as `slugify` above derives it. Nothing in this file mints one.
 */

/** Onboarding's own step (R-UI-033). A taken address is refused by name, in place. */
export async function createTenant(userId: string, name: string): Promise<TenantSummary> {
  const slug = slugify(name);
  // nobody holds this address: none can be derived at all. That is a different
  // problem from a taken one, and the screen must say which it is (R-UI-020).
  if (slug.length === 0) throw refusal('TENANT_NAME_UNREADABLE');

  const handle = await runAsSystem('onboarding: create a named tenant');
  const existing = await handle
    .select({ slug: tables.tenant.slug })
    .from(tables.tenant)
    .where(eq(tables.tenant.slug, slug));
  if (existing.length > 0) throw refusal('TENANT_SLUG_TAKEN');

  // The read above and the write below are two statements, so two people naming
  // one tenant at the same moment can both find the address free. The unique
  // index is the arbiter, and its verdict is the same refusal the read gives —
  // a coincidence of timing must not reach the screen as a 500 (AC-12).
  let created: { tenantId: string }[];
  try {
    created = await handle
      .insert(tables.tenant)
      .values({ slug, name, kind: 'team' })
      .returning({ tenantId: tables.tenant.tenantId });
  } catch (error) {
    if (isAddressTaken(error)) throw refusal('TENANT_SLUG_TAKEN');
    throw error;
  }

  const tenantId = created[0]?.tenantId;
  if (tenantId === undefined) throw refusal('TENANT_SLUG_TAKEN');

  await handle.insert(tables.tenantMember).values({ tenantId, userId, role: 'OWNER' });
  return { tenantId, slug, name, kind: 'team' };
}

/** Every tenant this account belongs to, newest first. */
export async function membershipsOf(userId: string): Promise<Membership[]> {
  const handle = await runAsSystem('session: list the tenants this account belongs to');
  return handle
    .select({
      tenantId: tables.tenant.tenantId,
      slug: tables.tenant.slug,
      name: tables.tenant.name,
      kind: tables.tenant.kind,
      role: tables.tenantMember.role,
    })
    .from(tables.tenantMember)
    .innerJoin(tables.tenant, eq(tables.tenant.tenantId, tables.tenantMember.tenantId))
    .where(eq(tables.tenantMember.userId, userId))
    .orderBy(desc(tables.tenant.createdAt));
}

/** The URL names a slug; the slug is resolved before any tenant scope exists. */
export async function resolveTenant(slug: string): Promise<TenantSummary | null> {
  const handle = await runAsSystem('routing: resolve the tenant named in the URL (D-01)');
  const rows = await handle
    .select({
      tenantId: tables.tenant.tenantId,
      slug: tables.tenant.slug,
      name: tables.tenant.name,
      kind: tables.tenant.kind,
    })
    .from(tables.tenant)
    .where(eq(tables.tenant.slug, slug));
  return rows[0] ?? null;
}

/**
 * Membership is read *through the tenant scope*: the policy is what makes a
 * non-member's lookup come back empty, so the refusal is the database's, not a
 * condition somebody remembered to write.
 */
export async function roleIn(tenantId: string, userId: string): Promise<string | null> {
  const handle = await forTenant({ tenantId });
  const rows = await handle
    .select({ role: tables.tenantMember.role })
    .from(tables.tenantMember)
    .where(and(eq(tables.tenantMember.tenantId, tenantId), eq(tables.tenantMember.userId, userId)));
  return rows[0]?.role ?? null;
}
